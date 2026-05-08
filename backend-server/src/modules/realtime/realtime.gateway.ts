import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) throw new UnauthorizedException();

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'super-secret-key',
      });

      client.data.user = payload;
      client.join(`user_${payload.sub}`);
      client.join(payload.role);

      this.logger.log(`Client Connected: ${payload.role} (${payload.sub})`);
    } catch (err) {
      this.logger.error(`Unauthorized connection attempt: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client Disconnected: ${client.id}`);
  }

  // --- Multi-Client Broadcasting ---

  broadcastToAdmins(event: string, data: any) {
    this.server.to('ADMIN').emit(event, data);
  }

  sendToCitizen(citizenId: string, event: string, data: any) {
    this.server.to(`user_${citizenId}`).emit(event, data);
  }

  sendToOfficer(officerId: string, event: string, data: any) {
    this.server.to(`user_${officerId}`).emit(event, data);
  }

  // --- Event Ingestion ---

  @SubscribeMessage('officer_location_update')
  handleOfficerLocation(client: Socket, payload: { lat: number, lng: number }) {
    const officerId = client.data.user.sub;
    this.broadcastToAdmins('officer_moved', { officerId, ...payload });
    // This logic usually goes through TrackingService for DB logging
  }
}

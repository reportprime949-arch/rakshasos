import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, UnauthorizedException } from '@nestjs/common';
import { EmergencyService } from '../modules/emergency/emergency.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EmergencyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EmergencyGateway');
  private connectedOfficers: Map<string, any> = new Map();

  constructor(
    @Inject(forwardRef(() => EmergencyService))
    private readonly emergencyService: EmergencyService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (token) {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'raksha_secret_key',
        });
        client.data.user = payload;
        this.logger.log(`🚨 AUTHENTICATED CLIENT CONNECTED: ${client.id} (User: ${payload.sub})`);
      } else {
        this.logger.log(`🚨 ANONYMOUS CLIENT CONNECTED: ${client.id}`);
      }
    } catch (err) {
      this.logger.warn(`⚠️ Socket connection authentication failed: ${err.message}`);
      // For now, we allow connection but log the warning. 
      // In strict production, we would client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 CLIENT DISCONNECTED: ${client.id}`);
    this.connectedOfficers.delete(client.id);
    this.broadcastRegistry();
  }

  @SubscribeMessage('officer:join')
  handleOfficerJoin(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`👮 OFFICER JOINED: ${data.officerId} (${client.id})`);
    this.connectedOfficers.set(client.id, {
      socketId: client.id,
      ...data,
    });
    this.broadcastRegistry();
    
    // Send current active incidents immediately on join
    this.emergencyService.getAllEmergencies().then(incidents => {
      client.emit('emergency:all', incidents);
    });
  }

  private broadcastRegistry() {
    this.server.emit('system:registry', {
      officersCount: this.connectedOfficers.size,
      timestamp: Date.now(),
    });
  }

  // Called from EmergencyService when a new SOS is created via POST
  emitNewEmergency(incident: any) {
    this.logger.log(`📢 EMITTING emergency:new for ID: ${incident.id}`);
    this.server.emit('emergency:new', incident);
  }

  @SubscribeMessage('officer:accept')
  async handleOfficerAccept(@MessageBody() data: any) {
    this.logger.log(`✅ OFFICER ACCEPTED: ${data.officerId} for SOS: ${data.id}`);
    
    // PERSIST IN MEMORY & SYNC
    await this.emergencyService.updateStatus(data.id, 'assigned', {
      assignedOfficerId: data.officerId,
      officerName: data.officerName || 'Officer Miller',
    });
  }

  emitUpdate(incident: any) {
    this.logger.log(`🔄 EMITTING emergency:update for ID: ${incident.id}`);
    this.server.emit('emergency:update', incident);
  }

  // For TrackingService
  broadcastToAdmins(event: string, data: any) {
    this.server.emit(event, data);
  }
}

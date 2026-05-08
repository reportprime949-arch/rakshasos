import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EmergencyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EmergencyGateway');

  handleConnection(client: Socket) {
    this.logger.log(`🚨 CLIENT CONNECTED: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 CLIENT DISCONNECTED: ${client.id}`);
  }

  // Called from EmergencyService when a new SOS is created via POST
  emitNewEmergency(incident: any) {
    this.logger.log(`📢 EMITTING emergency:new for ID: ${incident.id}`);
    this.server.emit('emergency:new', incident);
  }

  @SubscribeMessage('officer:accept')
  handleOfficerAccept(@MessageBody() data: any) {
    this.logger.log(`✅ OFFICER ACCEPTED: ${data.officerId} for SOS: ${data.id}`);
    this.server.emit('emergency:update', {
      ...data,
      status: 'assigned',
    });
  }

  emitUpdate(incident: any) {
    this.logger.log(`🔄 EMITTING emergency:update for ID: ${incident.id}`);
    this.server.emit('emergency:update', incident);
  }
}

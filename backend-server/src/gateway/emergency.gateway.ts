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
  namespace: '/emergency',
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://rakshasos-citizen.vercel.app',
      'https://rakshasos-officer.vercel.app',
      'https://rakshasos-admin.vercel.app',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class EmergencyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EmergencyGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Broadcast new emergency to all connected clients (Officers & Admins)
  broadcastNewEmergency(payload: any) {
    this.server.emit('new-emergency', payload);
  }

  // Broadcast officer assignment
  @SubscribeMessage('officer-accepted')
  handleOfficerAccepted(@MessageBody() data: { requestId: string; officerId: string; officerName: string }) {
    this.logger.log(`Officer ${data.officerName} accepted emergency ${data.requestId}`);
    this.server.emit('officer-dispatched', data);
  }

  broadcastUpdate(event: string, payload: any) {
    this.server.emit(event, payload);
  }
}

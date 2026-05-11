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
import { Logger, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import { EmergencyService } from '../modules/emergency/emergency.service';
import { RouteService } from '../modules/emergency/route.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EmergencyGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EmergencyGateway');
  private connectedOfficers: Map<string, any> = new Map();
  private processedIds: Set<string> = new Set();
  private lastRouteFetch: Map<string, number> = new Map();
  private lastLocationEmit: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  private readonly LOCATION_THROTTLE_MS = 2000; // Max 1 location update per 2s per officer

  constructor(
    @Inject(forwardRef(() => EmergencyService))
    private readonly emergencyService: EmergencyService,
    private readonly jwtService: JwtService,
    private readonly routeService: RouteService,
  ) {
    // Cleanup old processed IDs periodically
    this.cleanupInterval = setInterval(() => {
      this.processedIds.clear();
      if (this.lastRouteFetch.size > 500) this.lastRouteFetch.clear();
      if (this.lastLocationEmit.size > 500) this.lastLocationEmit.clear();
    }, 3600000); // 1 hour
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      
      if (token) {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'raksha_secret_key',
        });
        
        client.data.user = payload;
        this.logger.log(`✅ AUTHENTICATED: ${client.id} (Role: ${payload.role || 'user'})`);

        const userRole = (payload.role || '').toLowerCase();
        
        if (userRole === 'admin') {
          client.join('admins');
          client.join('dispatchers');
        } else if (userRole === 'officer') {
          client.join('officers');
          client.join('dispatchers');
        }
      } else {
        client.data.user = { role: 'citizen' };
        this.logger.log(`👤 CITIZEN CONNECTED: ${client.id}`);
      }
    } catch (err) {
      this.logger.warn(`❌ AUTH FAILED (Defaulting to Citizen): ${err.message}`);
      client.data.user = { role: 'citizen' };
    }
    
    // Log total connected clients
    const allSockets = await this.server.fetchSockets();
    this.logger.log(`📊 [CONNECTIONS] Total connected: ${allSockets.length}, Officers: ${this.connectedOfficers.size}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 DISCONNECTED: ${client.id}`);
    
    const officerData = this.connectedOfficers.get(client.id);
    if (officerData?.officerId) {
      this.lastRouteFetch.delete(officerData.officerId);
      this.lastLocationEmit.delete(officerData.officerId);
    }
    
    this.connectedOfficers.delete(client.id);
  }

  // ----------------------------------------------------------
  // HEARTBEAT — respond to client ping
  // ----------------------------------------------------------
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong');
  }

  @SubscribeMessage('officer:join')
  handleOfficerJoin(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`👮 OFFICER JOINED: ${data.officerId} (socket: ${client.id})`);
    
    client.join('officers');
    client.join('dispatchers');
    
    this.connectedOfficers.set(client.id, { socketId: client.id, ...data });
    this.broadcastRegistry();
    
    this.logger.log(`📊 [REGISTRY] Total officers now: ${this.connectedOfficers.size}`);
    
    this.emergencyService.getActiveEmergencies().then(incidents => {
      this.logger.log(`📦 [SYNC] Sending ${incidents.length} active incidents to officer ${data.officerId}`);
      client.emit('emergency:all', incidents);
    });
  }

  @SubscribeMessage('emergency:sync')
  async handleSync(@MessageBody() data: { lastTimestamp: number }, @ConnectedSocket() client: Socket) {
    this.logger.log(`🔄 SYNC REQUEST from ${client.id}`);
    const active = await this.emergencyService.getActiveEmergencies();
    this.logger.log(`📦 [SYNC] Sending ${active.length} active incidents`);
    client.emit('emergency:all', active);
  }

  private broadcastRegistry() {
    this.server.emit('system:registry', {
      officersCount: this.connectedOfficers.size,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('citizen:track')
  async handleCitizenTrack(@MessageBody() data: { incidentId: string }, @ConnectedSocket() client: Socket) {
    this.logger.log(`👁️ CITIZEN TRACKING START: ${data.incidentId}`);
    client.join(`incident_${data.incidentId}`);
    
    const incident = await this.emergencyService.getSOSById(data.incidentId);
    if (incident) {
      client.emit('emergency:update', incident);
    }
  }

  emitNewEmergency(incident: any) {
    const payload = { ...incident, msgId: `msg_${Date.now()}_${incident.id}` };

    this.logger.log(`══════════════════════════════════════════`);
    this.logger.log(`🚨 [BROADCAST] NEW EMERGENCY: ${incident.id}`);
    this.logger.log(`🚨 [BROADCAST] Citizen: ${incident.citizenName}`);
    this.logger.log(`🚨 [BROADCAST] Location: ${incident.latitude}, ${incident.longitude}`);
    this.logger.log(`🚨 [BROADCAST] Officers registered: ${this.connectedOfficers.size}`);
    
    // Broadcast to ALL connected clients for maximum reliability
    this.server.emit('emergency:new', payload);
    this.logger.log(`📢 [BROADCAST] Global broadcast sent (emergency:new)`);
    
    // Also emit specifically to officers room as backup
    this.server.to('officers').emit('emergency:new', payload);
    this.logger.log(`📢 [BROADCAST] Officers room broadcast sent`);
    
    // Also emit to dispatchers room
    this.server.to('dispatchers').emit('emergency:new', payload);
    this.logger.log(`📢 [BROADCAST] Dispatchers room broadcast sent`);

    this.logger.log(`✅ [BROADCAST] All channels notified for ${incident.id}`);
    this.logger.log(`══════════════════════════════════════════`);
  }

  @SubscribeMessage('officer:accept')
  async handleOfficerAccept(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    if (data.msgId && this.processedIds.has(data.msgId)) return;
    if (data.msgId) this.processedIds.add(data.msgId);

    this.logger.log(`✅ [ACTION] Officer ${data.officerId} accepted SOS: ${data.id}`);
    const result = await this.emergencyService.updateStatus(data.id, 'assigned', {
      assignedOfficerId: data.officerId,
      officerName: data.officerName || client.data.user?.name || 'Officer Miller',
    });

    // Emit the full updated incident back so officer gets complete data
    if (result) {
      this.server.to('dispatchers').to(`incident_${data.id}`).emit('emergency:update', {
        ...result,
        msgId: `upd_${Date.now()}_${data.id}`,
      });
      this.logger.log(`📡 [ACCEPT] Broadcast emergency:update for ${data.id} (status: assigned)`);
    }
  }

  @SubscribeMessage('officer:location_update')
  async handleLocationUpdate(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const officerId = data.officerId;
    const now = Date.now();
    const incidentId = data.incidentId || data.id;

    // ----------------------------------------------------------
    // THROTTLE: Max 1 location emit per 2s per officer
    // ----------------------------------------------------------
    const lastEmit = this.lastLocationEmit.get(officerId) || 0;
    if (now - lastEmit < this.LOCATION_THROTTLE_MS) return;
    this.lastLocationEmit.set(officerId, now);
    
    const lastFetch = this.lastRouteFetch.get(officerId) || 0;
    const shouldFetchRoute = now - lastFetch > 2000;

    const payload = {
      id: incidentId,
      officerId,
      latitude: data.latitude || data.lat,
      longitude: data.longitude || data.lng,
      timestamp: now
    };

    this.server.to('dispatchers').to(`incident_${incidentId}`).emit('officer_location_update', payload);

    if (shouldFetchRoute && incidentId) {
      this.lastRouteFetch.set(officerId, now);
      const activeSOS = await this.emergencyService.getSOSById(incidentId);

      if (activeSOS && activeSOS.status !== 'resolved') {
        const citizenLat = activeSOS.latitude || activeSOS.location?.lat;
        const citizenLng = activeSOS.longitude || activeSOS.location?.lng;

        if (citizenLat && citizenLng) {
          const routeData = await this.routeService.getRoute(
            activeSOS.id,
            [payload.latitude, payload.longitude],
            [citizenLat, citizenLng]
          );

          if (routeData) {
            this.server.to('dispatchers').to(`incident_${incidentId}`).emit('navigation:update', {
              id: activeSOS.id,
              ...routeData,
              timestamp: now
            });
          }
        }
      }
    }
  }

  emitUpdate(incident: any) {
    const payload = { ...incident, msgId: `upd_${Date.now()}_${incident.id}` };
    this.logger.log(`🔄 [BROADCAST] Status update for ${incident.id}: ${incident.status}`);
    this.server.to('dispatchers').to(`incident_${incident.id}`).emit('emergency:update', payload);
    
    // Also global broadcast for status updates to ensure all clients receive
    this.server.emit('emergency:update', payload);
  }

  broadcastToAdmins(event: string, data: any) {
    this.server.to('admins').emit(event, data);
  }
}

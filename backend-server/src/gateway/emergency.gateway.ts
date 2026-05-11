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

// Production CORS origins — must match main.ts
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'https://rakshasos.vercel.app',
  'https://rakshasos-3tro.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

@WebSocketGateway({
  transports: ['websocket', 'polling'],
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow upgrades on Render (required for WSS)
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000,
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

  private readonly LOCATION_THROTTLE_MS = 2000;

  constructor(
    @Inject(forwardRef(() => EmergencyService))
    private readonly emergencyService: EmergencyService,
    private readonly jwtService: JwtService,
    private readonly routeService: RouteService,
  ) {
    this.cleanupInterval = setInterval(() => {
      this.processedIds.clear();
      if (this.lastRouteFetch.size > 500) this.lastRouteFetch.clear();
      if (this.lastLocationEmit.size > 500) this.lastLocationEmit.clear();
    }, 3600000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  async handleConnection(client: Socket) {
    const transport = client.conn?.transport?.name || 'unknown';
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

      if (token) {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'raksha_secret_key',
        });

        client.data.user = payload;
        this.logger.log(`✅ AUTHENTICATED: ${client.id} (Role: ${payload.role || 'user'}, Transport: ${transport})`);

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
        this.logger.log(`👤 CITIZEN CONNECTED: ${client.id} (Transport: ${transport})`);
      }
    } catch (err) {
      this.logger.warn(`❌ AUTH FAILED: ${err.message} (Transport: ${transport})`);
      client.data.user = { role: 'citizen' };
    }

    // Log transport upgrade
    client.conn?.on('upgrade', (transport: any) => {
      this.logger.log(`⬆️ TRANSPORT UPGRADE: ${client.id} → ${transport.name}`);
    });

    const allSockets = await this.server.fetchSockets();
    this.logger.log(`📊 [CONNECTIONS] Total: ${allSockets.length}, Officers: ${this.connectedOfficers.size}`);
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

    this.emergencyService.getActiveEmergencies().then(incidents => {
      this.logger.log(`📦 [SYNC] Sending ${incidents.length} active incidents to officer ${data.officerId}`);
      client.emit('emergency:all', incidents);
    });
  }

  @SubscribeMessage('emergency:sync')
  async handleSync(@MessageBody() data: { lastTimestamp: number }, @ConnectedSocket() client: Socket) {
    this.logger.log(`🔄 SYNC REQUEST from ${client.id}`);
    const active = await this.emergencyService.getActiveEmergencies();
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
    this.logger.log(`👁️ CITIZEN TRACKING: ${data.incidentId}`);
    client.join(`incident_${data.incidentId}`);

    const incident = await this.emergencyService.getSOSById(data.incidentId);
    if (incident) {
      client.emit('emergency:update', incident);
    }
  }

  emitNewEmergency(incident: any) {
    const payload = { ...incident, msgId: `msg_${Date.now()}_${incident.id}` };
    this.logger.log(`🚨 [BROADCAST] New SOS: ${incident.id} from ${incident.citizenName}`);

    this.server.emit('emergency:new', payload);
    this.server.to('officers').emit('emergency:new', payload);
    this.server.to('dispatchers').emit('emergency:new', payload);

    this.logger.log(`✅ [BROADCAST] All channels notified for ${incident.id}`);
  }

  @SubscribeMessage('officer:accept')
  async handleOfficerAccept(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    if (data.msgId && this.processedIds.has(data.msgId)) return;
    if (data.msgId) this.processedIds.add(data.msgId);

    this.logger.log(`✅ Officer ${data.officerId} accepted SOS: ${data.id}`);
    const result = await this.emergencyService.updateStatus(data.id, 'assigned', {
      assignedOfficerId: data.officerId,
      officerName: data.officerName || client.data.user?.name || 'Officer Miller',
    });

    if (result) {
      this.server.to('dispatchers').to(`incident_${data.id}`).emit('emergency:update', {
        ...result,
        msgId: `upd_${Date.now()}_${data.id}`,
      });
    }
  }

  @SubscribeMessage('officer:resolve')
  async handleOfficerResolve(@MessageBody() data: { id: string; officerId: string }, @ConnectedSocket() client: Socket) {
    this.logger.log(`✅ Officer ${data.officerId} resolving SOS: ${data.id} via Socket`);
    const result = await this.emergencyService.resolveSOS(data.id, data.officerId);
    
    if (result) {
      // Clean up rooms
      client.leave(`incident_${data.id}`);
      this.server.to(`incident_${data.id}`).emit('emergency:resolved', { incidentId: data.id });
      this.logger.log(`🧹 Room incident_${data.id} cleaned up for ${client.id}`);
    }
  }

  @SubscribeMessage('officer:location_update')
  async handleLocationUpdate(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const officerId = data.officerId;
    const now = Date.now();
    const incidentId = data.incidentId || data.id;

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
      timestamp: now,
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
            [citizenLat, citizenLng],
          );

          if (routeData) {
            this.server.to('dispatchers').to(`incident_${incidentId}`).emit('navigation:update', {
              id: activeSOS.id,
              ...routeData,
              timestamp: now,
            });
          }
        }
      }
    }
  }

  emitUpdate(incident: any) {
    const payload = { ...incident, msgId: `upd_${Date.now()}_${incident.id}` };
    this.logger.log(`🔄 [BROADCAST] Status update: ${incident.id} → ${incident.status}`);
    this.server.to('dispatchers').to(`incident_${incident.id}`).emit('emergency:update', payload);
    this.server.emit('emergency:update', payload);
  }

  broadcastToAdmins(event: string, data: any) {
    this.server.to('admins').emit(event, data);
  }
}

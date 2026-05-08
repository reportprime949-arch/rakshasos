import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '../../redis.service';
import { EmergencyGateway } from '../../gateway/emergency.gateway';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TrackingService {
  constructor(
    private redis: RedisService,
    private gateway: EmergencyGateway,
    private prisma: PrismaService,
  ) {}

  async updateLocation(userId: string, lat: number, lng: number) {
    const profile = await this.prisma.officerProfile.findUnique({
      where: { userId },
    });

    if (!profile) throw new NotFoundException('Officer profile not found');

    const officerId = profile.id;

    // 1. Update Redis for real-time proximity
    await this.redis.updateResponderLocation(officerId, lat, lng);

    // 2. Broadcast to relevant rooms
    this.gateway.server.emit('officer_moved', { officerId, lat, lng });

    // Find if officer is currently on a dispatch
    const activeRequest = await this.prisma.emergencyRequest.findFirst({
      where: {
        officerId,
        status: { in: ['DISPATCHED', 'EN_ROUTE'] },
      },
    });

    if (activeRequest) {
      // In EmergencyGateway we use simple broadcast for now to ensure reliability
      this.gateway.server.emit('officer_location_update', { 
        id: activeRequest.id,
        citizenId: activeRequest.citizenId,
        lat, 
        lng 
      });
    }

    // 3. Batch persistent log (Async)
    this.prisma.gPSUpdate.create({
      data: { officerId, latitude: lat, longitude: lng },
    }).catch(err => console.error('Failed to log GPS update', err));
    
    return { success: true };
  }
}

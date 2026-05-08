import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis.service';
import { EmergencyStatus, OfficerStatus } from '../../types/enums';

@Injectable()
export class OfficerService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async updateStatus(userId: string, status: OfficerStatus) {
    const profile = await this.prisma.officerProfile.update({
      where: { userId },
      data: { status },
    });

    await this.redis.setResponderStatus(profile.id, status);
    return profile;
  }

  async acceptDispatch(userId: string, requestId: string) {
    const profile = await this.prisma.officerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Officer profile not found');

    const request = await this.prisma.emergencyRequest.findUnique({ where: { id: requestId } });
    if (!request || request.officerId !== profile.id) {
      throw new NotFoundException('Dispatch request not found or assigned to another responder');
    }

    return this.prisma.emergencyRequest.update({
      where: { id: requestId },
      data: {
        status: EmergencyStatus.EN_ROUTE,
        timeline: {
          create: {
            status: EmergencyStatus.EN_ROUTE,
            note: 'Officer is en route to location',
          },
        },
      },
    });
  }

  async completeDispatch(userId: string, requestId: string) {
    const profile = await this.prisma.officerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Officer profile not found');

    const update = await this.prisma.emergencyRequest.update({
      where: { id: requestId },
      data: {
        status: EmergencyStatus.RESOLVED,
        resolvedAt: new Date(),
        timeline: {
          create: {
            status: EmergencyStatus.RESOLVED,
            note: 'Emergency resolved successfully',
          },
        },
      },
    });

    await this.updateStatus(userId, OfficerStatus.AVAILABLE);
    return update;
  }
}

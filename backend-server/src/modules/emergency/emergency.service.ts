import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis.service';
import { EmergencyGateway } from '../../gateway/emergency.gateway';
import { FirebaseService } from '../../firebase/firebase.service';
import { EmergencyStatus } from '../../types/enums';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private emergencyGateway: EmergencyGateway,
    private firebase: FirebaseService,
  ) {}

  async createSOS(citizenId: string, lat: number, lng: number, description?: string) {
    const request = await this.prisma.emergencyRequest.create({
      data: {
        citizenId,
        latitude: lat,
        longitude: lng,
        description,
        status: EmergencyStatus.PENDING,
        timeline: {
          create: {
            status: EmergencyStatus.PENDING,
            note: 'Emergency Alert Triggered',
          },
        },
      },
      include: {
        citizen: { select: { name: true, phone: true } },
      },
    });

    this.logger.log(`SOS Created: ${request.id}`);
    
    // Sync to Firestore
    const db = this.firebase.getFirestore();
    await db.collection('emergencies').doc(request.id).set({
      id: request.id,
      citizenId: request.citizenId,
      citizenName: request.citizen.name,
      lat,
      lng,
      description: description || 'SOS Triggered',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Send Push Notification via FCM
    await this.firebase.getMessaging().send({
      topic: 'emergencies',
      notification: {
        title: '🚨 Emergency Alert',
        body: `Citizen SOS detected nearby: ${request.citizen.name}`,
      },
      data: {
        id: request.id,
        lat: String(lat),
        lng: String(lng),
      },
    });

    return request;
  }

  async acceptEmergency(requestId: string, userId: string) {
    const profile = await this.prisma.officerProfile.findUnique({ 
      where: { userId },
      include: { user: true }
    });
    if (!profile) throw new Error('Officer profile not found');

    const update = await this.prisma.emergencyRequest.update({
      where: { id: requestId },
      data: {
        officerId: profile.id,
        status: EmergencyStatus.DISPATCHED,
        timeline: {
          create: {
            status: EmergencyStatus.DISPATCHED,
            note: 'Officer accepted and is en route',
          },
        },
      },
      include: { officer: { include: { user: true } } },
    });

    // Sync to Firestore
    const db = this.firebase.getFirestore();
    await db.collection('emergencies').doc(requestId).update({
      status: 'ASSIGNED',
      officerId: profile.id,
      officerName: profile.user.name,
      updatedAt: new Date(),
    });

    return update;
  }

  async getAllEmergencies() {
    return this.prisma.emergencyRequest.findMany({
      include: { citizen: true, officer: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    // Basic mapping for simplicity
    const prismaStatus = status as any; 
    
    const update = await this.prisma.emergencyRequest.update({
      where: { id },
      data: { status: prismaStatus },
    });

    // Sync to Firestore
    const db = this.firebase.getFirestore();
    await db.collection('emergencies').doc(id).update({
      status,
      updatedAt: new Date(),
    });

    return update;
  }
}

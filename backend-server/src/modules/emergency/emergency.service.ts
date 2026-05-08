import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EmergencyGateway } from '../../gateway/emergency.gateway';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  
  // In-memory storage for SOS complaints
  private sosComplaints: any[] = [];

  constructor(
    @Inject(forwardRef(() => EmergencyGateway))
    private readonly gateway: EmergencyGateway,
    private readonly firebase: FirebaseService,
  ) {}

  async createSOS(data: { citizenName?: string; citizenId?: string; emergencyType: string; latitude?: number; longitude?: number; location?: { lat: number; lng: number } }) {
    const lat = data.latitude ?? data.location?.lat ?? 0;
    const lng = data.longitude ?? data.location?.lng ?? 0;

    const newSOS = {
      id: `SOS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      citizenId: data.citizenId || 'anonymous',
      citizenName: data.citizenName || 'Unknown Citizen',
      emergencyType: data.emergencyType,
      location: { lat, lng },
      latitude: lat,
      longitude: lng,
      lat,
      lng,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'pending',
    };

    this.sosComplaints.push(newSOS);
    this.logger.log(`🚨 SOS CREATED: ${newSOS.id} for ${newSOS.citizenName}`);
    
    // FIREBASE SYNC
    try {
      const db = this.firebase.getFirestore();
      if (db) {
        await db.collection('emergencies').doc(newSOS.id).set({
          ...newSOS,
          updatedAt: new Date().toISOString(),
        });
        this.logger.log(`🔥 [FIREBASE] Sync Success: ${newSOS.id}`);
      }
      
      // BROADCAST PUSH NOTIFICATION TO ALL OFFICERS
      await this.firebase.sendPushNotification(
        'officers_topic', // Assuming a topic for officers
        '🚨 NEW EMERGENCY SOS',
        `${newSOS.emergencyType.toUpperCase()} alert from ${newSOS.citizenName}`,
        { incidentId: newSOS.id }
      );
    } catch (err) {
      this.logger.error(`🔥 [FIREBASE] Sync/Notify Failed: ${err.message}`);
    }

    // REALTIME EMIT
    this.logger.log(`📡 EMITTING TO OFFICERS: ${newSOS.id}`);
    this.gateway.emitNewEmergency(newSOS);

    return newSOS;
  }

  async getAllEmergencies() {
    this.logger.log(`📊 Complaints fetched: ${this.sosComplaints.length} found`);
    return this.sosComplaints;
  }

  async updateStatus(id: string, status: string, officerData?: any) {
    const index = this.sosComplaints.findIndex(s => s.id === id);
    if (index !== -1) {
      this.sosComplaints[index] = {
        ...this.sosComplaints[index],
        status,
        ...officerData,
        updatedAt: new Date().toISOString(),
      };
      
      this.logger.log(`✅ Incident Updated: ${id} to ${status}`);
      
      // FIREBASE SYNC
      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(id).update({
            status,
            ...officerData,
            updatedAt: new Date().toISOString(),
          });
          this.logger.log(`🔥 [FIREBASE] Update Success: ${id}`);
        }

        // NOTIFY CITIZEN
        if (['assigned', 'enroute', 'arrived'].includes(status)) {
          const incident = this.sosComplaints[index];
          await this.firebase.sendPushNotification(
            incident.citizenId, // Ideally an FCM token stored in DB
            '🚔 OFFICER UPDATE',
            `Officer is ${status === 'assigned' ? 'responding' : status === 'enroute' ? 'on the way' : 'arrived'}.`,
            { incidentId: id, status }
          );
        }
      } catch (err) {
        this.logger.error(`🔥 [FIREBASE] Update Failed: ${err.message}`);
      }

      // REALTIME UPDATE EMIT
      this.gateway.emitUpdate(this.sosComplaints[index]);

      // ANALYTICS LOGGING
      if (status === 'completed' || status === 'resolved') {
        const incident = this.sosComplaints[index];
        const durationMs = Date.now() - incident.timestamp;
        const durationMin = (durationMs / 60000).toFixed(2);
        
        try {
          const db = this.firebase.getFirestore();
          if (db) {
            await db.collection('system_analytics').add({
              incidentId: id,
              type: incident.emergencyType,
              durationMin,
              officerId: officerData?.assignedOfficerId,
              timestamp: new Date().toISOString(),
            });
            this.logger.log(`📊 [ANALYTICS] Incident ${id} resolved in ${durationMin} min`);
          }
        } catch (err) {
          this.logger.error(`📊 [ANALYTICS] Logging failed: ${err.message}`);
        }
      }
      
      return this.sosComplaints[index];
    }
    return null;
  }

  async getSOSById(id: string) {
    return this.sosComplaints.find(s => s.id === id);
  }
}

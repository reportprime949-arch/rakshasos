import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EmergencyGateway } from '../../gateway/emergency.gateway';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  
  private sosComplaints: any[] = [];
  private archivedComplaints: any[] = [];

  constructor(
    @Inject(forwardRef(() => EmergencyGateway))
    private readonly gateway: EmergencyGateway,
    private readonly firebase: FirebaseService,
  ) {}

  async createSOS(data: any) {
    try {
      const lat = data.latitude ?? data.location?.lat ?? 0;
      const lng = data.longitude ?? data.location?.lng ?? 0;

      const newSOS = {
        id: `SOS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        citizenName: data.citizenName || 'Unknown Citizen',
        emergencyType: data.emergencyType || 'General',
        location: { lat, lng },
        latitude: lat,
        longitude: lng,
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
        status: 'pending',
      };

      this.sosComplaints.push(newSOS);
      
      // BROADCAST
      this.gateway.emitNewEmergency(newSOS);

      return newSOS;
    } catch (error) {
      this.logger.error(`CREATE SOS ERROR: ${error.message}`);
      throw error;
    }
  }

  async getAllEmergencies() {
    return [...this.sosComplaints, ...this.archivedComplaints];
  }

  async getActiveEmergencies() {
    return this.sosComplaints.filter(s => s.status !== 'resolved');
  }

  async updateStatus(id: string, status: string, data: any = {}) {
    const index = this.sosComplaints.findIndex(s => s.id === id);
    if (index !== -1) {
      this.sosComplaints[index] = {
        ...this.sosComplaints[index],
        status,
        ...data,
        updatedAt: new Date().toISOString()
      };
      this.gateway.emitUpdate(this.sosComplaints[index]);
      return this.sosComplaints[index];
    }
    return null;
  }

  async resolveSOS(id: string, officerId: string) {
    const index = this.sosComplaints.findIndex(s => s.id === id);
    if (index !== -1) {
      const resolved = {
        ...this.sosComplaints[index],
        status: 'resolved',
        resolvedBy: officerId,
        resolvedAt: new Date().toISOString()
      };
      this.sosComplaints.splice(index, 1);
      this.archivedComplaints.push(resolved);
      this.gateway.emitUpdate(resolved);
      return resolved;
    }
    return null;
  }

  async cleanupAllIncidents() {
    const count = this.sosComplaints.length;
    this.sosComplaints = [];
    this.archivedComplaints = [];
    return { success: true, purged: count };
  }

  // STEP 8 — RECONNECT REAL LOGIC
  async arrive(id: string) {
    this.logger.log(`🚔 ARRIVAL CONFIRMED: ${id}`);
    try {
      const result = await this.updateStatus(id, 'arrived', {
        arrivedAt: new Date().toISOString()
      });

      if (!result) {
        throw new Error(`Incident ${id} not found`);
      }

      // SYNC TO FIREBASE
      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(id).update({
            status: 'arrived',
            arrivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          this.logger.log(`🔥 [FIREBASE] Arrive Sync: ${id}`);
        }
      } catch (fErr) {
        this.logger.warn(`⚠️ [FIREBASE] Sync Failed: ${fErr.message}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`ARRIVE SERVICE ERROR: ${error.message}`);
      throw error;
    }
  }

  async getSOSById(id: string) {
    return this.sosComplaints.find(s => s.id === id) || this.archivedComplaints.find(s => s.id === id);
  }
}

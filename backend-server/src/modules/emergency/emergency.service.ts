import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EmergencyGateway } from '../../gateway/emergency.gateway';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  private sosComplaints: any[] = [];
  private archivedComplaints: any[] = [];
  private recentFingerprints: Map<string, { sos: any; createdAt: number }> = new Map();

  private readonly DEDUP_WINDOW_MS = 10000;

  constructor(
    @Inject(forwardRef(() => EmergencyGateway))
    private readonly gateway: EmergencyGateway,
    private readonly firebase: FirebaseService,
  ) {}

  async createSOS(data: any) {
    const now = Date.now();
    const citizenId = data.citizenId || 'UNKNOWN';
    const fingerprint = `${citizenId}-${data.emergencyType}`;

    this.logger.log(`🚨 [CREATE SOS] Incoming: ${data.citizenName} (${citizenId}) at ${data.latitude},${data.longitude}`);

    // 1. Cleanup old fingerprints
    for (const [key, val] of this.recentFingerprints.entries()) {
      if (now - val.createdAt > 20000) this.recentFingerprints.delete(key);
    }

    // 2. Check for active emergency for this citizenId
    const activeEmergency = this.sosComplaints.find(
      s => s.citizenId === citizenId && !['resolved', 'completed', 'cancelled'].includes(s.status)
    );

    if (activeEmergency) {
      this.logger.log(`♻️ [DEDUP] Citizen ${citizenId} already has active SOS: ${activeEmergency.id}`);
      return { ...activeEmergency, success: true, alreadyActive: true };
    }

    // 3. Cooldown check per fingerprint
    const existing = this.recentFingerprints.get(fingerprint);
    if (existing && now - existing.createdAt < 20000) {
      this.logger.log(`♻️ [DEDUP] Fingerprint cooldown: ${fingerprint}`);
      return { ...existing.sos, success: true, alreadyActive: true };
    }

    try {
      const lat = data.latitude ?? data.location?.lat ?? 0;
      const lng = data.longitude ?? data.location?.lng ?? 0;

      if (lat === 0 && lng === 0) {
        throw new Error('Valid coordinates are required for SOS');
      }

      const newSOS = {
        id: `SOS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        citizenName: data.citizenName || 'Unknown Citizen',
        citizenId: data.citizenId || 'UNKNOWN',
        emergencyType: data.emergencyType || 'General',
        location: { lat, lng },
        latitude: lat,
        longitude: lng,
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
        status: 'pending',
      };

      this.sosComplaints.push(newSOS);
      this.recentFingerprints.set(fingerprint, { sos: newSOS, createdAt: now });

      this.logger.log(`✅ [CREATE SOS] ${newSOS.id} created`);
      this.gateway.emitNewEmergency(newSOS);

      // Sync to Firebase Firestore
      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(newSOS.id).set({
            ...newSOS,
            updatedAt: new Date().toISOString(),
          });
          this.logger.log(`🔥 [FIREBASE] SOS synced: ${newSOS.id}`);
        }
      } catch (fErr) {
        this.logger.warn(`⚠️ [FIREBASE] Sync failed: ${fErr.message}`);
      }

      return { ...newSOS, success: true };
    } catch (error) {
      this.logger.error(`❌ [CREATE SOS] ERROR: ${error.message}`);
      throw error;
    }
  }

  async getAllEmergencies() {
    return [...this.sosComplaints, ...this.archivedComplaints];
  }

  async getActiveEmergencies() {
    return this.sosComplaints
      .filter(s => s.status !== 'resolved')
      .map(s => ({ ...s, _fetchedAt: Date.now() }));
  }

  async updateStatus(id: string, status: string, data: any = {}) {
    const index = this.sosComplaints.findIndex(s => s.id === id);
    if (index !== -1) {
      this.sosComplaints[index] = {
        ...this.sosComplaints[index],
        status,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      this.gateway.emitUpdate(this.sosComplaints[index]);

      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(id).update({
            status,
            ...data,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (fErr) {
        this.logger.warn(`⚠️ [FIREBASE] Status sync failed: ${fErr.message}`);
      }

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
        resolvedAt: new Date().toISOString(),
      };

      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(id).update({
            status: 'resolved',
            resolvedBy: officerId,
            resolvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (fErr) {
        this.logger.warn(`⚠️ [FIREBASE] Resolve sync failed: ${fErr.message}`);
      }

      this.gateway.server.emit('emergency:resolved', { incidentId: id });
      this.sosComplaints.splice(index, 1);
      this.archivedComplaints.push(resolved);
      this.gateway.emitUpdate(resolved);
      return { ...resolved, success: true };
    }
    return null;
  }

  async cleanupAllIncidents() {
    const count = this.sosComplaints.length;
    this.sosComplaints = [];
    this.archivedComplaints = [];
    this.recentFingerprints.clear();
    return { success: true, purged: count };
  }

  async arrive(id: string) {
    this.logger.log(`🚔 ARRIVAL CONFIRMED: ${id}`);
    try {
      const result = await this.updateStatus(id, 'arrived', {
        arrivedAt: new Date().toISOString(),
      });
      if (!result) throw new Error(`Incident ${id} not found`);
      return { ...result, success: true };
    } catch (error) {
      this.logger.error(`ARRIVE ERROR: ${error.message}`);
      throw error;
    }
  }

  async getSOSById(id: string) {
    return this.sosComplaints.find(s => s.id === id) || this.archivedComplaints.find(s => s.id === id);
  }
}

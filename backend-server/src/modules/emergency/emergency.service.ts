import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EmergencyGateway } from '../../gateway/emergency.gateway';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  
  private sosComplaints: any[] = [];
  private archivedComplaints: any[] = [];
  private recentFingerprints: Map<string, { sos: any; createdAt: number }> = new Map();

  private readonly DEDUP_WINDOW_MS = 10000; // 10 second dedup window

  constructor(
    @Inject(forwardRef(() => EmergencyGateway))
    private readonly gateway: EmergencyGateway,
    private readonly firebase: FirebaseService,
  ) {}

  async createSOS(data: any) {
    const now = Date.now();
    const ts = data.timestamp || now;
    const fingerprint = `${data.citizenName}-${data.emergencyType}-${ts}`;

    this.logger.log(`══════════════════════════════════════════`);
    this.logger.log(`🚨 [CREATE SOS] Incoming SOS request`);
    this.logger.log(`🚨 [CREATE SOS] citizenName: ${data.citizenName}`);
    this.logger.log(`🚨 [CREATE SOS] citizenId: ${data.citizenId}`);
    this.logger.log(`🚨 [CREATE SOS] lat: ${data.latitude}, lng: ${data.longitude}`);
    this.logger.log(`🚨 [CREATE SOS] fingerprint: ${fingerprint}`);
    this.logger.log(`══════════════════════════════════════════`);

    // Prune expired fingerprints
    for (const [key, val] of this.recentFingerprints.entries()) {
      if (now - val.createdAt > this.DEDUP_WINDOW_MS) this.recentFingerprints.delete(key);
    }

    // SHORT-WINDOW dedup (10s) — prevents accidental double-tap, NOT long-term blocking
    const existing = this.recentFingerprints.get(fingerprint);
    if (existing && now - existing.createdAt < this.DEDUP_WINDOW_MS) {
      this.logger.log(`♻️ [DEDUP] Same SOS within ${this.DEDUP_WINDOW_MS}ms window: ${fingerprint}`);
      // Re-broadcast anyway so officer gets it even if first emit was missed
      this.gateway.emitNewEmergency(existing.sos);
      return { ...existing.sos, success: true };
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
        timestamp: ts,
        status: 'pending',
      };

      this.sosComplaints.push(newSOS);
      this.recentFingerprints.set(fingerprint, { sos: newSOS, createdAt: now });
      
      this.logger.log(`✅ [CREATE SOS] New SOS created: ${newSOS.id}`);
      this.logger.log(`✅ [CREATE SOS] Status: ${newSOS.status}`);
      this.logger.log(`✅ [CREATE SOS] Location: ${lat}, ${lng}`);

      // ── STEP 1: BROADCAST TO ALL CONNECTED WEBSOCKET CLIENTS ──
      this.logger.log(`📡 [BROADCAST] Broadcasting emergency:new to all clients...`);
      this.gateway.emitNewEmergency(newSOS);
      this.logger.log(`📡 [BROADCAST] ✅ Broadcast complete`);

      // ── STEP 2: SYNC TO FIREBASE FIRESTORE ──
      // This ensures officer Firestore listeners pick up the new emergency
      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(newSOS.id).set({
            ...newSOS,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          this.logger.log(`🔥 [FIREBASE] SOS synced to Firestore: ${newSOS.id}`);
        } else {
          this.logger.warn(`⚠️ [FIREBASE] Firestore not available — skipping sync`);
        }
      } catch (fErr) {
        this.logger.warn(`⚠️ [FIREBASE] Sync failed (non-critical): ${fErr.message}`);
      }

      this.logger.log(`══════════════════════════════════════════`);
      this.logger.log(`✅ [CREATE SOS] Pipeline complete for ${newSOS.id}`);
      this.logger.log(`══════════════════════════════════════════`);

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
    // Always return fresh — no caching
    return this.sosComplaints
      .filter(s => s.status !== 'resolved')
      .map(s => ({
        ...s,
        _fetchedAt: Date.now(), // Timestamp for staleness detection
      }));
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

      this.logger.log(`🔄 [UPDATE] Incident ${id} → ${status}`);
      this.gateway.emitUpdate(this.sosComplaints[index]);

      // Sync status update to Firebase
      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(id).update({
            status,
            ...data,
            updatedAt: new Date().toISOString(),
          });
          this.logger.log(`🔥 [FIREBASE] Status sync: ${id} → ${status}`);
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
        resolvedAt: new Date().toISOString()
      };

      // 1. SYNC TO FIREBASE
      try {
        const db = this.firebase.getFirestore();
        if (db) {
          await db.collection('emergencies').doc(id).update({
            status: 'resolved',
            resolvedBy: officerId,
            resolvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          this.logger.log(`🔥 [FIREBASE] Resolution Sync: ${id}`);
        }
      } catch (fErr) {
        this.logger.warn(`⚠️ [FIREBASE] Sync Failed: ${fErr.message}`);
      }

      // 2. EMIT TO REALTIME CLIENTS
      this.gateway.server.emit('emergency:resolved', { incidentId: id });
      
      // 3. REMOVE FROM ACTIVE MEMORY
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
        arrivedAt: new Date().toISOString()
      });

      if (!result) {
        throw new Error(`Incident ${id} not found`);
      }

      return { ...result, success: true };
    } catch (error) {
      this.logger.error(`ARRIVE SERVICE ERROR: ${error.message}`);
      throw error;
    }
  }

  async getSOSById(id: string) {
    return this.sosComplaints.find(s => s.id === id) || this.archivedComplaints.find(s => s.id === id);
  }
}

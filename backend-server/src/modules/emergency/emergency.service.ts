import { Injectable, Logger } from '@nestjs/common';
import { EmergencyGateway } from '../../gateway/emergency.gateway';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  
  // In-memory storage for SOS complaints
  private sosComplaints: any[] = [];

  constructor(private readonly gateway: EmergencyGateway) {}

  async createSOS(data: { citizenName?: string; citizenId?: string; emergencyType: string; location: { lat: number; lng: number } }) {
    const newSOS = {
      id: `SOS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      citizenId: data.citizenId || 'anonymous',
      citizenName: data.citizenName || 'Unknown Citizen',
      emergencyType: data.emergencyType,
      location: data.location,
      lat: data.location.lat,
      lng: data.location.lng,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'pending',
    };

    this.sosComplaints.push(newSOS);
    this.logger.log(`🚨 SOS CREATED: ${newSOS.id} for ${newSOS.citizenName}`);
    
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
      
      // REALTIME UPDATE EMIT
      this.gateway.emitUpdate(this.sosComplaints[index]);
      
      return this.sosComplaints[index];
    }
    return null;
  }

  async getSOSById(id: string) {
    return this.sosComplaints.find(s => s.id === id);
  }
}

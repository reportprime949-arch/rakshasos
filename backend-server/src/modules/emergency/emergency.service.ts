import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  
  // In-memory storage for SOS complaints
  private sosComplaints: any[] = [];

  async createSOS(data: { citizenName: string; emergencyType: string; location: { lat: number; lng: number } }) {
    const newSOS = {
      id: `SOS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      citizenName: data.citizenName,
      emergencyType: data.emergencyType,
      location: data.location,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    this.sosComplaints.push(newSOS);
    this.logger.log(`🚨 SOS Created: ${newSOS.id} for ${newSOS.citizenName}`);
    return newSOS;
  }

  async getAllEmergencies() {
    this.logger.log(`📊 Complaints fetched: ${this.sosComplaints.length} found`);
    return this.sosComplaints;
  }

  async updateStatus(id: string, status: string) {
    const index = this.sosComplaints.findIndex(s => s.id === id);
    if (index !== -1) {
      this.sosComplaints[index].status = status;
      this.logger.log(`✅ Officer assigned/Status updated: ${id} to ${status}`);
      return this.sosComplaints[index];
    }
    return null;
  }

  // Helper for polling or finding specific SOS
  async getSOSById(id: string) {
    return this.sosComplaints.find(s => s.id === id);
  }
}

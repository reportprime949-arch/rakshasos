import { Controller, Post, Body, Get, Patch, Param, Logger } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

@Controller('api/emergency')
export class EmergencyController {
  private readonly logger = new Logger(EmergencyController.name);

  constructor(private emergencyService: EmergencyService) {}

  @Get()
  async getAll() {
    this.logger.log('📊 Fetching all active incidents');
    return this.emergencyService.getAllEmergencies();
  }

  @Post()
  async createSOS(@Body() body: { citizenName: string; emergencyType: string; latitude: number; longitude: number; location: { lat: number; lng: number } }) {
    try {
      this.logger.log(`🚨 SOS RECEIVED from ${body.citizenName}`);
      const result = await this.emergencyService.createSOS(body);
      return {
        success: true,
        message: 'Emergency alert sent',
        ...result,
      };
    } catch (error) {
      this.logger.error('❌ SOS FAILED:', error);
      return {
        success: false,
        error: 'Server error',
      };
    }
  }

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    this.logger.log(`✅ Updating status for ${id} to ${status}`);
    return this.emergencyService.updateStatus(id, status);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.emergencyService.getSOSById(id);
  }
}

import { Controller, Post, Body, Get, Patch, Param, Logger } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

@Controller('emergency')
export class EmergencyController {
  private readonly logger = new Logger(EmergencyController.name);

  constructor(private emergencyService: EmergencyService) {}

  @Get()
  async testRoute() {
    this.logger.log('📡 Emergency test route accessed');
    return { success: true, module: 'emergency working' };
  }

  @Post('sos')
  async createSOS(@Body() body: { citizenName: string; emergencyType: string; location: { lat: number; lng: number } }) {
    return this.emergencyService.createSOS(body);
  }

  @Get('list')
  async getAll() {
    return this.emergencyService.getAllEmergencies();
  }

  @Patch('sos/:id')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.emergencyService.updateStatus(id, status);
  }

  @Get('sos/:id')
  async getById(@Param('id') id: string) {
    return this.emergencyService.getSOSById(id);
  }
}

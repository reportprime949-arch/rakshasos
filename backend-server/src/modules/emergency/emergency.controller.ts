import { Controller, Post, Body, Get, Patch, Param, Logger } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

@Controller('sos')
export class EmergencyController {
  private readonly logger = new Logger(EmergencyController.name);

  constructor(private emergencyService: EmergencyService) {}

  @Post()
  async createSOS(@Body() body: { citizenName: string; emergencyType: string; location: { lat: number; lng: number } }) {
    return this.emergencyService.createSOS(body);
  }

  @Get()
  async getAll() {
    return this.emergencyService.getAllEmergencies();
  }

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.emergencyService.updateStatus(id, status);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.emergencyService.getSOSById(id);
  }
}

import { Controller, Post, Body, Get, Patch, Param, Logger, UseGuards } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CreateEmergencyDto } from './dto/create-emergency.dto';

@Controller('api/emergency')
export class EmergencyController {
  private readonly logger = new Logger(EmergencyController.name);

  constructor(private emergencyService: EmergencyService) {}

  @Get('health')
  health() {
    return { ok: true, timestamp: new Date().toISOString() };
  }

  @Patch(':id/arrive')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('officer', 'admin')
  async arriveEmergency(@Param('id') id: string) {
    try {
      const result = await this.emergencyService.arrive(id);
      return { status: 'arrived', incidentId: id, ...result, success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin') // Restricted PII to admins only
  async getAll() {
    return await this.emergencyService.getAllEmergencies();
  }

  @Get('active')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('officer', 'admin')
  async getActive() {
    return await this.emergencyService.getActiveEmergencies();
  }

  @Post()
  // SOS Creation is public (victims can report without login)
  async createSOS(@Body() body: CreateEmergencyDto) {
    try {
      const result = await this.emergencyService.createSOS(body);
      return { ...result, success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Patch(':id/resolve')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('officer', 'admin')
  async resolve(@Param('id') id: string) {
    try {
      const result = await this.emergencyService.resolveSOS(id, 'SYSTEM');
      return { success: true, status: 'resolved', incidentId: id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('cleanup')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin') // Critical destructive action
  async cleanup() {
    return await this.emergencyService.cleanupAllIncidents();
  }

  @Get(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('officer', 'admin')
  async getById(@Param('id') id: string) {
    return await this.emergencyService.getSOSById(id);
  }

  @Patch(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('officer', 'admin')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    try {
      const result = await this.emergencyService.updateStatus(id, status);
      return { ...result, success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}


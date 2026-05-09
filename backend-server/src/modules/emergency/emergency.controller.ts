import { Controller, Post, Body, Get, Patch, Param, Logger } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

@Controller('api/emergency')
export class EmergencyController {
  private readonly logger = new Logger(EmergencyController.name);

  constructor(private emergencyService: EmergencyService) {}

  // PART 2 — VERIFY PATCH ROUTE WORKS
  @Get('health')
  health() {
    console.log('HEALTH CHECK HIT');
    return {
      ok: true,
      timestamp: new Date().toISOString()
    };
  }

  // STEP 3 — EXACT ARRIVE ROUTE HANDLER
  @Patch(':id/arrive')
  async arriveEmergency(@Param('id') id: string) {
    console.log('Officer arrived:', id);
    
    try {
      const result = await this.emergencyService.arrive(id);
      
      // Ensure we return exactly what the user requested
      return {
        success: true,
        status: 'arrived',
        incidentId: id,
        ...result // Include real updated data for frontend sync
      };
    } catch (error) {
      console.error('ARRIVE ERROR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Get()
  async getAll() {
    try {
      return await this.emergencyService.getAllEmergencies();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('active')
  async getActive() {
    try {
      return await this.emergencyService.getActiveEmergencies();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post()
  async createSOS(@Body() body: any) {
    try {
      const result = await this.emergencyService.createSOS(body);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string) {
    try {
      const result = await this.emergencyService.resolveSOS(id, 'SYSTEM');
      return { success: true, status: 'resolved', incidentId: id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('cleanup')
  async cleanup() {
    try {
      return await this.emergencyService.cleanupAllIncidents();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    try {
      return await this.emergencyService.getSOSById(id);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

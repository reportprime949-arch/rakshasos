import { Controller, Post, Body, UseGuards, Req, Get, Patch, Param } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('emergency')
export class EmergencyController {
  constructor(private emergencyService: EmergencyService) {}

  @UseGuards(JwtAuthGuard)
  @Post('sos')
  triggerSOS(@Req() req: any, @Body() body: { lat: number; lng: number; description?: string }) {
    return this.emergencyService.createSOS(req.user.id, body.lat, body.lng, body.description);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getAll() {
    return this.emergencyService.getAllEmergencies();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.emergencyService.updateStatus(id, status);
  }
}

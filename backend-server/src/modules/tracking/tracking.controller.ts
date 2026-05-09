import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tracking')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  @Post('location')
  updateLocation(@Req() req: any, @Body() body: { latitude: number; longitude: number; lat?: number; lng?: number }) {
    const lat = body.latitude ?? body.lat ?? 0;
    const lng = body.longitude ?? body.lng ?? 0;
    return this.trackingService.updateLocation(req.user.id, lat, lng);
  }
}

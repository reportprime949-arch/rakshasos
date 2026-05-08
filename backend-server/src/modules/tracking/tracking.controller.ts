import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tracking')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  @Post('location')
  updateLocation(@Req() req: any, @Body() body: { lat: number, lng: number }) {
    return this.trackingService.updateLocation(req.user.id, body.lat, body.lng);
  }
}

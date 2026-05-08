import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { RedisService } from '../../redis.service';
import { EmergencyModule } from '../emergency/emergency.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [EmergencyModule],
  controllers: [TrackingController],
  providers: [TrackingService, RedisService, PrismaService],
  exports: [TrackingService],
})
export class TrackingModule {}

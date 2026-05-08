import { Module } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis.service';
import { EmergencyGateway } from '../../gateway/emergency.gateway';

@Module({
  imports: [RealtimeModule],
  controllers: [EmergencyController],
  providers: [EmergencyService, PrismaService, RedisService, EmergencyGateway],
  exports: [EmergencyService, EmergencyGateway],
})
export class EmergencyModule {}

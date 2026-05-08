import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { OfficerModule } from './modules/officer/officer.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AuditModule } from './modules/audit/audit.module';

import { FirebaseModule } from './firebase/firebase.module';

@Module({
  imports: [
    FirebaseModule,
    AuthModule,
    UserModule,
    EmergencyModule,
    TrackingModule,
    OfficerModule,
    NotificationModule,
    AuditModule,
  ],
  controllers: [],
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class AppModule {}

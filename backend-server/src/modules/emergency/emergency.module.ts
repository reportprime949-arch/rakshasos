import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';
import { EmergencyGateway } from '../../gateway/emergency.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService, EmergencyGateway],
  exports: [EmergencyService, EmergencyGateway],
})
export class EmergencyModule {}

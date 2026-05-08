import { Module } from '@nestjs/common';
import { EmergencyController } from './emergency.controller';

@Module({
  controllers: [EmergencyController],
})
export class EmergencyModule {}

import { Module } from '@nestjs/common';
import { OfficerService } from './officer.service';
import { OfficerController } from './officer.controller';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis.service';

@Module({
  controllers: [OfficerController],
  providers: [OfficerService, PrismaService, RedisService],
})
export class OfficerModule {}

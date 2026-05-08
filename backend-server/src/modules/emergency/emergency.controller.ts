import { Controller, Get } from '@nestjs/common';

@Controller('api/emergency')
export class EmergencyController {

  @Get()
  getEmergency() {
    return {
      success: true,
      message: 'Emergency API working',
    };
  }
}

import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { OfficerService } from './officer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OfficerStatus } from '../../types/enums';

@Controller('officer')
@UseGuards(JwtAuthGuard)
export class OfficerController {
  constructor(private officerService: OfficerService) {}

  @Post('status')
  updateStatus(@Req() req: any, @Body('status') status: OfficerStatus) {
    return this.officerService.updateStatus(req.user.id, status);
  }

  @Post('accept/:requestId')
  acceptDispatch(@Req() req: any, @Param('requestId') requestId: string) {
    return this.officerService.acceptDispatch(req.user.id, requestId);
  }

  @Post('complete/:requestId')
  completeDispatch(@Req() req: any, @Param('requestId') requestId: string) {
    return this.officerService.completeDispatch(req.user.id, requestId);
  }
}

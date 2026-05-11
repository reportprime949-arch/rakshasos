import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: any) {
    // DEV BYPASS for E2E testing when login UI is not yet implemented
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      const request = context.switchToHttp().getRequest();
      request.user = { id: 'dev-officer-id', role: 'OFFICER' };
      return true;
    }
    return super.canActivate(context);
  }
}


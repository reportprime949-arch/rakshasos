import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | any | Promise<boolean | any> | Observable<boolean | any> {
    const client = context.switchToWs().getClient();
    const authToken = client.handshake.headers.authorization?.split(' ')[1];

    try {
      const payload = this.jwtService.verify(authToken);
      return payload;
    } catch (err) {
      return false;
    }
  }
}

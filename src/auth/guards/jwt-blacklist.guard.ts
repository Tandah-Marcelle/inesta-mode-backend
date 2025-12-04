import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenBlacklistService } from '../token-blacklist.service';

@Injectable()
export class JwtBlacklistGuard extends JwtAuthGuard {
  constructor(private readonly tokenBlacklistService: TokenBlacklistService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (authHeader) {
      const token = this.tokenBlacklistService.extractToken(authHeader);
      if (token && this.tokenBlacklistService.isTokenBlacklisted(token)) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
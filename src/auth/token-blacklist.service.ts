import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TokenBlacklistService implements OnModuleInit {
  private blacklistedTokens = new Set<string>();

  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    console.log('TokenBlacklistService initialized');
  }

  /**
   * Add a token to the blacklist
   */
  blacklistToken(token: string): void {
    this.blacklistedTokens.add(token);
  }

  /**
   * Check if a token is blacklisted
   */
  isTokenBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Extract token from authorization header
   */
  extractToken(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Clean up expired tokens from blacklist
   * This should be called periodically to prevent memory leaks
   */
  cleanupExpiredTokens(jwtService: JwtService): void {
    const now = Math.floor(Date.now() / 1000);
    
    for (const token of this.blacklistedTokens) {
      try {
        const decoded = jwtService.decode(token) as any;
        if (decoded && decoded.exp && decoded.exp < now) {
          this.blacklistedTokens.delete(token);
        }
      } catch (error) {
        // If token can't be decoded, remove it
        this.blacklistedTokens.delete(token);
      }
    }
  }

  /**
   * Get the number of blacklisted tokens (for monitoring)
   */
  getBlacklistSize(): number {
    return this.blacklistedTokens.size;
  }

  /**
   * Scheduled task to clean up expired tokens every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleTokenCleanup() {
    if (this.jwtService) {
      const sizeBefore = this.blacklistedTokens.size;
      this.cleanupExpiredTokens(this.jwtService);
      const sizeAfter = this.blacklistedTokens.size;
      if (sizeBefore > sizeAfter) {
        console.log(`Cleaned up ${sizeBefore - sizeAfter} expired tokens. Remaining: ${sizeAfter}`);
      }
    }
  }
}
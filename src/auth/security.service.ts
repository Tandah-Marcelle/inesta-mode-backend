import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { UserSession } from '../entities/user-session.entity';
import { SecurityLog, SecurityEventType, SecurityRiskLevel } from '../entities/security-log.entity';

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface SecurityContext {
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  device?: string;
}

@Injectable()
export class SecurityService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour
  private readonly EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private sessionRepository: Repository<UserSession>,
    @InjectRepository(SecurityLog)
    private securityLogRepository: Repository<SecurityLog>,
    private configService: ConfigService,
  ) {}

  // MFA Methods
  async setupMfa(userId: string): Promise<MfaSetupResult> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `Inesta Mode (${user.email})`,
      issuer: 'Inesta Mode',
      length: 32,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');
    const backupCodes = this.generateBackupCodes();

    // Save secret (don't enable MFA yet - user needs to verify)
    user.mfaSecret = secret.base32;
    user.backupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );
    await this.userRepository.save(user);

    await this.logSecurityEvent(
      userId,
      SecurityEventType.MFA_ENABLED,
      'MFA setup initiated',
      SecurityRiskLevel.LOW
    );

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  async enableMfa(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (verified) {
      user.isMfaEnabled = true;
      await this.userRepository.save(user);

      await this.logSecurityEvent(
        userId,
        SecurityEventType.MFA_ENABLED,
        'MFA successfully enabled',
        SecurityRiskLevel.LOW
      );
    }

    return verified;
  }

  async verifyMfaToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      return false;
    }

    // Check if it's a backup code
    if (token.length === 8 && user.backupCodes) {
      for (let i = 0; i < user.backupCodes.length; i++) {
        const isValidBackup = await bcrypt.compare(token, user.backupCodes[i]);
        if (isValidBackup) {
          // Remove used backup code
          user.backupCodes.splice(i, 1);
          await this.userRepository.save(user);

          await this.logSecurityEvent(
            userId,
            SecurityEventType.MFA_BACKUP_USED,
            'Backup code used for authentication',
            SecurityRiskLevel.MEDIUM
          );

          return true;
        }
      }
    }

    // Verify TOTP token
    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  async disableMfa(userId: string, password: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return false;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return false;
    }

    user.isMfaEnabled = false;
    user.mfaSecret = null;
    user.backupCodes = null;
    await this.userRepository.save(user);

    await this.logSecurityEvent(
      userId,
      SecurityEventType.MFA_DISABLED,
      'MFA disabled',
      SecurityRiskLevel.MEDIUM
    );

    return true;
  }

  // Account Security Methods
  async recordFailedLogin(email: string, context: SecurityContext): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Log attempt even for non-existent users
      await this.logSecurityEvent(
        null,
        SecurityEventType.LOGIN_FAILED,
        `Failed login attempt for non-existent email: ${email}`,
        SecurityRiskLevel.MEDIUM,
        context
      );
      return;
    }

    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
      await this.logSecurityEvent(
        user.id,
        SecurityEventType.ACCOUNT_LOCKED,
        `Account locked after ${this.MAX_LOGIN_ATTEMPTS} failed attempts`,
        SecurityRiskLevel.HIGH,
        context
      );
    } else {
      await this.logSecurityEvent(
        user.id,
        SecurityEventType.LOGIN_FAILED,
        `Failed login attempt (${user.failedLoginAttempts}/${this.MAX_LOGIN_ATTEMPTS})`,
        SecurityRiskLevel.MEDIUM,
        context
      );
    }

    await this.userRepository.save(user);
  }

  async recordSuccessfulLogin(userId: string, context: SecurityContext): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return;
    }

    // Reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.lastLoginIp = context.ipAddress || null;
    user.lastLoginUserAgent = context.userAgent || null;

    await this.userRepository.save(user);

    await this.logSecurityEvent(
      userId,
      SecurityEventType.LOGIN_SUCCESS,
      'Successful login',
      SecurityRiskLevel.LOW,
      context
    );
  }

  async isAccountLocked(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { email } });
    return user ? user.isLocked : false;
  }

  async unlockAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return;
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepository.save(user);

    await this.logSecurityEvent(
      userId,
      SecurityEventType.ACCOUNT_UNLOCKED,
      'Account manually unlocked',
      SecurityRiskLevel.LOW
    );
  }

  // Session Management
  async createSession(userId: string, context: SecurityContext): Promise<string> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION);

    const session = this.sessionRepository.create({
      userId,
      sessionToken,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      location: context.location,
      device: context.device,
      expiresAt,
      lastActivityAt: new Date(),
    });

    await this.sessionRepository.save(session);
    return sessionToken;
  }

  async validateSession(sessionToken: string): Promise<UserSession | null> {
    const session = await this.sessionRepository.findOne({
      where: { sessionToken, isActive: true },
      relations: ['user'],
    });

    if (!session || session.isExpired) {
      if (session) {
        session.isActive = false;
        await this.sessionRepository.save(session);
      }
      return null;
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return session;
  }

  async revokeSession(sessionToken: string): Promise<void> {
    await this.sessionRepository.update(
      { sessionToken },
      { isActive: false }
    );
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.update(
      { userId, isActive: true },
      { isActive: false }
    );

    await this.logSecurityEvent(
      userId,
      SecurityEventType.LOGOUT,
      'All sessions revoked',
      SecurityRiskLevel.LOW
    );
  }

  async getUserActiveSessions(userId: string): Promise<UserSession[]> {
    return this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivityAt: 'DESC' },
    });
  }

  // Password Security
  async generatePasswordResetToken(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + this.PASSWORD_RESET_EXPIRY);
    await this.userRepository.save(user);

    await this.logSecurityEvent(
      userId,
      SecurityEventType.PASSWORD_RESET_REQUESTED,
      'Password reset token generated',
      SecurityRiskLevel.MEDIUM
    );

    return resetToken;
  }

  async validatePasswordResetToken(token: string): Promise<User | null> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: hashedToken },
    });

    if (!user || !user.isPasswordResetValid) {
      return null;
    }

    return user;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await this.validatePasswordResetToken(token);
    if (!user) {
      return false;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.passwordChangedAt = new Date();
    user.requirePasswordChange = false;

    await this.userRepository.save(user);

    // Revoke all sessions
    await this.revokeAllUserSessions(user.id);

    await this.logSecurityEvent(
      user.id,
      SecurityEventType.PASSWORD_RESET_COMPLETED,
      'Password reset completed',
      SecurityRiskLevel.MEDIUM
    );

    return true;
  }

  // Utility Methods
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private async logSecurityEvent(
    userId: string | null,
    eventType: SecurityEventType,
    description: string,
    riskLevel: SecurityRiskLevel,
    context?: SecurityContext,
    metadata?: Record<string, any>
  ): Promise<void> {
    const log = this.securityLogRepository.create({
      userId,
      eventType,
      riskLevel,
      description,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      location: context?.location,
      metadata,
    });

    await this.securityLogRepository.save(log);
  }

  // Admin Methods
  async getSecurityLogs(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    eventType?: SecurityEventType,
    riskLevel?: SecurityRiskLevel
  ): Promise<{ logs: SecurityLog[]; total: number }> {
    const query = this.securityLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC');

    if (userId) {
      query.andWhere('log.userId = :userId', { userId });
    }

    if (eventType) {
      query.andWhere('log.eventType = :eventType', { eventType });
    }

    if (riskLevel) {
      query.andWhere('log.riskLevel = :riskLevel', { riskLevel });
    }

    const [logs, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { logs, total };
  }

  async getSecurityStats(): Promise<{
    totalEvents: number;
    highRiskEvents: number;
    lockedAccounts: number;
    activeSessions: number;
  }> {
    const [totalEvents, highRiskEvents, lockedAccounts, activeSessions] = await Promise.all([
      this.securityLogRepository.count(),
      this.securityLogRepository.count({ where: { riskLevel: SecurityRiskLevel.HIGH } }),
      this.userRepository.count({ where: { lockedUntil: new Date() } }),
      this.sessionRepository.count({ where: { isActive: true } }),
    ]);

    return {
      totalEvents,
      highRiskEvents,
      lockedAccounts,
      activeSessions,
    };
  }
}
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { LoginDto, RegisterDto, AuthResponseDto } from './dto/auth.dto';
import { JwtPayload } from './jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { SecurityService, SecurityContext } from './security.service';

export interface MfaLoginDto extends LoginDto {
  mfaToken?: string;
}

export interface EnhancedAuthResponseDto extends AuthResponseDto {
  requiresMfa?: boolean;
  sessionToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly securityService: SecurityService,
  ) {}

  async register(registerDto: RegisterDto, context: SecurityContext): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName, phone } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate password strength
    this.validatePasswordStrength(password);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const user = this.userRepository.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      role: UserRole.USER,
      isActive: true,
      requirePasswordChange: false,
    });

    const savedUser = await this.userRepository.save(user);

    // Create session
    const sessionToken = await this.securityService.createSession(savedUser.id, context);

    // Generate JWT token
    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: savedUser.id,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        email: savedUser.email,
        role: savedUser.role,
      },
    };
  }

  async login(loginDto: MfaLoginDto, context: SecurityContext): Promise<EnhancedAuthResponseDto> {
    const { email, password, mfaToken } = loginDto;

    // Check if account is locked
    const isLocked = await this.securityService.isAccountLocked(email);
    if (isLocked) {
      throw new UnauthorizedException('Account is temporarily locked due to multiple failed login attempts');
    }

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      await this.securityService.recordFailedLogin(email, context);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.securityService.recordFailedLogin(email, context);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if MFA is required
    if (user.isMfaEnabled) {
      if (!mfaToken) {
        return {
          access_token: null,
          user: null,
          requiresMfa: true,
        };
      }

      const isMfaValid = await this.securityService.verifyMfaToken(user.id, mfaToken);
      if (!isMfaValid) {
        await this.securityService.recordFailedLogin(email, context);
        throw new UnauthorizedException('Invalid MFA token');
      }
    }

    // Check if password change is required
    if (user.requirePasswordChange) {
      throw new UnauthorizedException('Password change required');
    }

    // Record successful login
    await this.securityService.recordSuccessfulLogin(user.id, context);

    // Create session
    const sessionToken = await this.securityService.createSession(user.id, context);

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      sessionToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isLocked) {
      throw new UnauthorizedException('Account is locked');
    }

    return user;
  }

  async logout(token: string, sessionToken?: string): Promise<{ message: string }> {
    // Add JWT token to blacklist
    this.tokenBlacklistService.blacklistToken(token);
    
    // Revoke session if provided
    if (sessionToken) {
      await this.securityService.revokeSession(sessionToken);
    }

    // Update user's last activity
    try {
      const decoded = this.jwtService.decode(token) as JwtPayload;
      if (decoded && decoded.sub) {
        await this.userRepository.update(
          { id: decoded.sub },
          { lastLoginAt: new Date() }
        );
      }
    } catch (error) {
      console.warn('Could not decode token for logout:', error.message);
    }

    return { message: 'Logout successful' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Validate new password strength
    this.validatePasswordStrength(newPassword);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.requirePasswordChange = false;
    await this.userRepository.save(user);

    // Revoke all sessions except current one
    await this.securityService.revokeAllUserSessions(userId);

    return { message: 'Password changed successfully' };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = await this.securityService.generatePasswordResetToken(user.id);
    
    // TODO: Send email with reset token
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    this.validatePasswordStrength(newPassword);
    
    const success = await this.securityService.resetPassword(token, newPassword);
    if (!success) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    return { message: 'Password reset successfully' };
  }

  // MFA Methods
  async setupMfa(userId: string) {
    return this.securityService.setupMfa(userId);
  }

  async enableMfa(userId: string, token: string): Promise<{ message: string }> {
    const success = await this.securityService.enableMfa(userId, token);
    if (!success) {
      throw new BadRequestException('Invalid MFA token');
    }

    return { message: 'MFA enabled successfully' };
  }

  async disableMfa(userId: string, password: string): Promise<{ message: string }> {
    const success = await this.securityService.disableMfa(userId, password);
    if (!success) {
      throw new BadRequestException('Invalid password');
    }

    return { message: 'MFA disabled successfully' };
  }

  // Admin Methods
  async createSecureAdmin(): Promise<{ message: string; tempPassword?: string }> {
    const adminEmail = 'admin@inestamode.com';
    
    // Check if admin already exists
    const existingAdmin = await this.userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      return { message: 'Admin user already exists' };
    }

    // Generate secure temporary password
    const tempPassword = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create admin user
    const admin = this.userRepository.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
      requirePasswordChange: true, // Force password change on first login
    });

    await this.userRepository.save(admin);

    return {
      message: 'Secure admin user created. Please change the password on first login.',
      tempPassword, // Only return this once during setup
    };
  }

  // Utility Methods
  private validatePasswordStrength(password: string): void {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      throw new BadRequestException(`Password must be at least ${minLength} characters long`);
    }

    if (!hasUpperCase) {
      throw new BadRequestException('Password must contain at least one uppercase letter');
    }

    if (!hasLowerCase) {
      throw new BadRequestException('Password must contain at least one lowercase letter');
    }

    if (!hasNumbers) {
      throw new BadRequestException('Password must contain at least one number');
    }

    if (!hasSpecialChar) {
      throw new BadRequestException('Password must contain at least one special character');
    }
  }

  private generateSecurePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each required category
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

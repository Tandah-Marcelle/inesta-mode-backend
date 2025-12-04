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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName, phone } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

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
    });

    const savedUser = await this.userRepository.save(user);

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

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
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

    return user;
  }

  async logout(token: string): Promise<{ message: string }> {
    // Add token to blacklist
    this.tokenBlacklistService.blacklistToken(token);
    
    // Update user's last logout time (optional)
    try {
      const decoded = this.jwtService.decode(token) as JwtPayload;
      if (decoded && decoded.sub) {
        await this.userRepository.update(
          { id: decoded.sub },
          { lastLoginAt: new Date() } // Using lastLoginAt to track last activity
        );
      }
    } catch (error) {
      // If token can't be decoded, that's fine - just blacklist it
      console.warn('Could not decode token for logout:', error.message);
    }

    return { message: 'Logout successful' };
  }

  async createAdmin(createAdminDto?: RegisterDto): Promise<User> {
    // Use provided data or defaults
    const adminEmail = createAdminDto?.email || 'admin@inestamode.com';
    const adminPassword = createAdminDto?.password || 'admin123456';
    const firstName = createAdminDto?.firstName || 'Admin';
    const lastName = createAdminDto?.lastName || 'User';

    // Check if admin already exists
    const existingAdmin = await this.userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      return existingAdmin;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const admin = this.userRepository.create({
      firstName,
      lastName,
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    });

    return await this.userRepository.save(admin);
  }
}

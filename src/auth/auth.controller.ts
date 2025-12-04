import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, AuthResponseDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtBlacklistGuard } from './guards/jwt-blacklist.guard';
import { GetUser } from './decorators/get-user.decorator';
import { User } from '../entities/user.entity';
import { TokenBlacklistService } from './token-blacklist.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  @Post('register')
  async register(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    registerDto: RegisterDto,
  ): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    loginDto: LoginDto,
  ): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('create-admin')
  async createAdmin(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createAdminDto?: RegisterDto,
  ) {
    const admin = await this.authService.createAdmin(createAdminDto);
    return {
      message: 'Admin user created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtBlacklistGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') authHeader: string) {
    const token = this.tokenBlacklistService.extractToken(authHeader);
    if (!token) {
      return { message: 'No token provided' };
    }
    return this.authService.logout(token);
  }

  @Get('validate')
  @UseGuards(JwtBlacklistGuard)
  @HttpCode(HttpStatus.OK)
  async validateToken(@GetUser() user: User) {
    return {
      valid: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  }

  @Get('me')
  @UseGuards(JwtBlacklistGuard)
  async getProfile(@GetUser() user: User) {
    // Fetch fresh user data from database
    const freshUser = await this.authService.validateUser(user.id);
    return {
      user: {
        id: freshUser.id,
        firstName: freshUser.firstName,
        lastName: freshUser.lastName,
        email: freshUser.email,
        role: freshUser.role,
      },
    };
  }
}

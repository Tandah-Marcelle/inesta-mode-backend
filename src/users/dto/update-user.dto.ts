import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, MinLength, IsArray, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { UserRole } from '../../entities/user.entity';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ description: 'User password', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ description: 'Array of permission IDs to assign to the user', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissions?: string[];
}

export class UpdateUserPasswordDto {
  @ApiPropertyOptional({ description: 'New password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateUserRoleDto {
  @ApiPropertyOptional({ description: 'User role', enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserStatusDto {
  @ApiPropertyOptional({ description: 'Whether user is active' })
  @IsBoolean()
  isActive: boolean;
}
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDate,
  IsEmail,
  IsUrl,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartnerDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsString()
  partnershipType: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  partnershipStartDate?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  achievements?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsDate,
  IsIn,
  IsNumber,
  IsUrl,
  ValidateIf,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateNewsDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  @IsIn(['news', 'event'])
  category: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '' || value === null || value === undefined) {
      return undefined;
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  })
  @ValidateIf((obj, value) => value !== undefined)
  @IsDate()
  eventDate?: Date;

  @IsOptional()
  @IsString()
  eventLocation?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;
}
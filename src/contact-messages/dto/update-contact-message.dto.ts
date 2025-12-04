import { IsOptional, IsEnum, IsString } from 'class-validator';
import { MessageStatus, MessagePriority } from '../../entities/contact-message.entity';

export class UpdateContactMessageDto {
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
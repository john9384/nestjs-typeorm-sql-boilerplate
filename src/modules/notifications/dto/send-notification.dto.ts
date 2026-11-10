import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationRequest,
} from '../notification.contract';

class NotificationRecipientDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;
}

/** Also validated for internal events, which bypass HTTP validation pipes. */
export class SendNotificationDto implements NotificationRequest {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationRecipientDto)
  recipient: NotificationRecipientDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  html?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

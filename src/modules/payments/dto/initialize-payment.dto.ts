import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Internal service input. Payment initiation belongs in trusted business services. */
export class InitializePaymentDto {
  @IsUUID()
  userId: string;

  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Amount in currency subunits (e.g. kobo)',
    example: 10000,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,49}$/)
  provider?: string;
}

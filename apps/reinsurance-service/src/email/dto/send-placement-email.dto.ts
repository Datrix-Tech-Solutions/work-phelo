import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class PlacementEmailRecipientDto {
  @ApiProperty({ example: 'underwriter@example.com' })
  @TrimmedString()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: 'Avenue Re Underwriting' })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}

export class SendPlacementEmailDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mailboxConnectionId!: string;

  @ApiProperty({ type: [PlacementEmailRecipientDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  to!: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  cc?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  bcc?: PlacementEmailRecipientDto[];

  @ApiProperty({ example: 'Offer slip for FAC/2026/001' })
  @TrimmedString()
  @IsString()
  @MaxLength(255)
  subject!: string;

  @ApiPropertyOptional({ example: 'Please review the attached offer details.' })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bodyText?: string;

  @ApiPropertyOptional({
    example: '<p>Please review the attached offer details.</p>',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;
}

export class ReplyPlacementEmailDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mailboxConnectionId!: string;

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  to?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  cc?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  bcc?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ example: 'Following up on this placement.' })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bodyText?: string;

  @ApiPropertyOptional({ example: '<p>Following up on this placement.</p>' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;
}

import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewCorrectionDto {
  @IsEnum(['APPROVED', 'REJECTED']) action!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() note?: string;
}

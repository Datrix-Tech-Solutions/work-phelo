import { IsDateString, IsString, IsOptional } from 'class-validator';

export class TimeCorrectionDto {
  @IsDateString() date!: string;
  @IsOptional() @IsDateString() requestedIn?: string;
  @IsOptional() @IsDateString() requestedOut?: string;
  @IsString() reason!: string;
}

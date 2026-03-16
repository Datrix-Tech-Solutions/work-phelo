import { IsOptional, IsString } from 'class-validator';

export class ClockInDto {
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() note?: string;
}

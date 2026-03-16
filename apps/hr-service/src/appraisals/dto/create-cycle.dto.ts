import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateAppraisalCycleDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}

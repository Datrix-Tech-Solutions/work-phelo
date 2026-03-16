import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString() leaveTypeId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() reason?: string;
}

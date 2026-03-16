import { IsString, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString() name!: string;
  @IsInt() @Min(1) daysAllowed!: number;
  @IsOptional() @IsBoolean() isCarryOver?: boolean;
  @IsOptional() @IsInt() maxCarryOverDays?: number;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsOptional() @IsBoolean() isPaid?: boolean;
}

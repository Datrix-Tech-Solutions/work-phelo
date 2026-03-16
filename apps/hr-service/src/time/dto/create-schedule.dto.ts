import {
  IsString,
  IsEnum,
  IsArray,
  IsInt,
  IsDateString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ShiftType } from '../../../prisma/generated/client';

export class CreateScheduleDto {
  @IsString() employeeId!: string;
  @IsEnum(ShiftType) shiftType!: ShiftType;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  dayOfWeek!: number[];
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

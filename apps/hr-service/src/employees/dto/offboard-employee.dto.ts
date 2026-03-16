import { IsString, IsDateString } from 'class-validator';

export class OffboardEmployeeDto {
  @IsDateString()
  offboardedAt!: string;

  @IsString()
  reason!: string;
}

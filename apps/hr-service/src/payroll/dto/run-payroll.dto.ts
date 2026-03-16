import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class RunPayrollDto {
  @IsInt() @Min(1) @Max(12) month!: number;
  @IsInt() @Min(2020) year!: number;
  @IsOptional() @IsString() notes?: string;
}

import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class SubmitReviewDto {
  @IsInt() @Min(1) @Max(5) score!: number;
  @IsOptional() @IsString() comment?: string;
}

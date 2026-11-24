import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, ValidateIf } from 'class-validator';

export class UpdateProjectMemberDto {
  @ApiProperty({
    nullable: true,
    description:
      'What the member’s logged time is billed at, per hour; null clears it',
  })
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0.01)
  hourlyRate!: number | null;
}

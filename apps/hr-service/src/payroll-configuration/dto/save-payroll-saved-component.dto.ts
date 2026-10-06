import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class SavePayrollSavedComponentDto {
  @ApiProperty({ example: 'SSNIT Tier 2 (employee)' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    type: Object,
    description:
      'The component. Links to other components are dropped, since they only mean something inside one configuration.',
  })
  @IsObject()
  component!: Record<string, unknown>;
}

import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetGroupEmployeesDto {
  @ApiProperty({
    type: [String],
    description:
      'Every employee who should be in the group. Anyone not listed is taken out, and anyone ' +
      'listed is moved out of the group they were in.',
  })
  @IsArray()
  @ArrayMaxSize(5000)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  employeeIds!: string[];
}

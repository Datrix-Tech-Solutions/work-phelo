import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateLeaveRequestDto } from './create-leave-request.dto';

/** A leave request filed by HR for another employee. It is recorded as already approved. */
export class CreateOnBehalfLeaveRequestDto extends CreateLeaveRequestDto {
  @ApiProperty({
    description: 'The employee the leave is being recorded for',
    example: 'c10f6f65-0c36-4b0f-9a56-f7cfbc2f2d90',
  })
  @IsUUID()
  employeeId!: string;
}

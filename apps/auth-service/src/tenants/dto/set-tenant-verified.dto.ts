import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetTenantVerifiedDto {
  @ApiProperty({
    description: 'Show the verified check mark next to the company',
  })
  @IsBoolean()
  isVerified!: boolean;
}

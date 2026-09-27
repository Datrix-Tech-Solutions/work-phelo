import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PayrollSettlementDto {
  @ApiProperty({ description: 'Tenant the payroll run belongs to' })
  @IsUUID()
  tenantId!: string;
}

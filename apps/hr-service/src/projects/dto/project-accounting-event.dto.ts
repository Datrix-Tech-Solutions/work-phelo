import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, MaxLength } from 'class-validator';

export enum ProjectAccountingEvent {
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
  REJECTED = 'REJECTED',
}

/** What Accounting reports about a transaction it was given. */
export class ProjectAccountingEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: 'PROJECTS' })
  @IsString()
  sourceModule!: string;

  @ApiProperty({ description: "Accounting's id for the transaction." })
  @IsString()
  @MaxLength(100)
  transactionId!: string;

  @ApiProperty({ enum: ProjectAccountingEvent })
  @IsEnum(ProjectAccountingEvent)
  event!: ProjectAccountingEvent;
}

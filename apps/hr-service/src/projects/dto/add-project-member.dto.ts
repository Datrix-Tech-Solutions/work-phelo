import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ProjectMemberRole } from '../../../prisma/generated/client';

export class AddProjectMemberDto {
  @ApiProperty({ example: '05ba7933-1078-4409-8242-95a08540a9d5' })
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional({
    enum: ProjectMemberRole,
    example: ProjectMemberRole.MEMBER,
  })
  @IsOptional()
  @IsEnum(ProjectMemberRole)
  role?: ProjectMemberRole;

  @ApiPropertyOptional({
    description: 'What this member’s logged time is billed at, per hour',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  hourlyRate?: number;
}

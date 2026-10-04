import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class InternalDirectoryQueryDto {
  @ApiProperty({ description: 'Tenant the request is made on behalf of' })
  @IsUUID()
  tenantId!: string;
}

export class InternalResolveDirectoryDto extends InternalDirectoryQueryDto {
  @ApiPropertyOptional({
    description: 'Auth user ID to resolve to an employee (e.g. the requester).',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Employee IDs that must all be active employees of the tenant.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  employeeIds?: string[];

  @ApiPropertyOptional({
    description:
      'Auth user IDs that must all belong to active employees of the tenant.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  userIds?: string[];
}

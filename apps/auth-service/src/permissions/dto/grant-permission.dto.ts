import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum PermissionAction {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  RUN = 'RUN',
  EXPORT = 'EXPORT',
  ASSIGN = 'ASSIGN',
}

export class GrantPermissionDto {
  @IsString()
  userId!: string;

  @IsString()
  resourceId!: string;

  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokePermissionDto {
  @IsString()
  userId!: string;

  @IsString()
  resourceId!: string;

  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignPermissionSetDto {
  @IsString()
  userId!: string;

  @IsString()
  permissionSetId!: string;
}

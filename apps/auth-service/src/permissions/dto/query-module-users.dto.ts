import { IsString, Matches, MaxLength } from 'class-validator';

export class QueryModuleUsersDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z_]+$/, {
    message: 'module must be an upper-case resource module, e.g. MARKETING',
  })
  module!: string;
}

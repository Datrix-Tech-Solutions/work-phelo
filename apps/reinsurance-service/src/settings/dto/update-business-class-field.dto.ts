import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBusinessClassFieldDto } from './create-business-class-field.dto';

export class UpdateBusinessClassFieldDto extends PartialType(
  OmitType(CreateBusinessClassFieldDto, ['section', 'fieldKey'] as const),
) {}

import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadUserDocumentDto {
  @ApiProperty({
    description: 'Free-text label for the document, e.g. "Identification"',
    example: 'Identification',
  })
  @IsString()
  @MinLength(1)
  category!: string;
}

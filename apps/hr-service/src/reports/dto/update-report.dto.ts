import { PartialType } from '@nestjs/swagger';
import { SaveReportDto } from './save-report.dto';

export class UpdateReportDto extends PartialType(SaveReportDto) {}

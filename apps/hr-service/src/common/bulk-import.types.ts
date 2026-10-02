export interface BulkImportRowResult {
  rowNumber: number;
  status: 'created' | 'failed';
  id?: string;
  message?: string;
  warnings: string[];
}

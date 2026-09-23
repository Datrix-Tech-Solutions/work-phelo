export type DocumentFolderKey = 'personal' | 'company';

export type DocumentFileKind = 'pdf' | 'image' | 'spreadsheet' | 'doc' | 'other';

export interface MyDocument {
  id: string;
  folder: DocumentFolderKey;
  name: string;
  fileKind: DocumentFileKind;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  category: string;
  previewUrl?: string;
}

export function inferFileKind(mimeType: string): DocumentFileKind {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

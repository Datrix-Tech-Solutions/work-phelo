import type { DocumentType } from '@/types/hr';

export type DocumentFolderKey = 'personal' | 'company';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CONTRACT: 'Contract',
  ID_CARD: 'ID Card',
  PASSPORT: 'Passport',
  CERTIFICATE: 'Certificate',
  OFFER_LETTER: 'Offer Letter',
  NDA: 'NDA',
  OTHER: 'Other',
};

// Personal documents have no backend enum (UserDocument.category is a plain
// string) — this is just a curated set of suggestions for the dropdown, with
// "Other" falling back to free text.
export const PERSONAL_DOCUMENT_CATEGORIES = [
  'Identification',
  'Passport',
  'Certificate',
  'Educational Document',
  'Employment Reference',
  'Medical Record',
  'Other',
] as const;

export type DocumentFileKind = 'pdf' | 'image' | 'spreadsheet' | 'doc' | 'other';

export interface MyDocument {
  id: string;
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

/** Keys of the documents the studio can preview — one per entry in documentRegistry. */
export type PreviewDoc =
  | 'payslip'
  | 'bill'
  | 'invoice'
  | 'credit-note'
  | 'debit-note'
  | 'payment-receipt'
  | 'payment-voucher';

export type WatermarkMode = 'none' | 'text' | 'image';
export type SlotPosition = 'start' | 'middle' | 'end';
export type SignaturePosition = 'left' | 'right';

//water mark opacity
export const WATERMARK_OPACITY = 0.2;
// for text water mark sits at a -30 degree angle and for the image there would be no angle so it would sit upright
export const WATERMARK_TEXT_ANGLE = -30;
export const WATERMARK_IMAGE_ANGLE = 0;

export interface DocumentTemplate {
  previewDoc: PreviewDoc;
  // Letterhead
  logo: string | null;
  showLogo: boolean;
  logoPosition: SlotPosition;
  companyName: string;
  identityLines: string;
  showCompanyName: boolean;
  companyNamePosition: SlotPosition;
  showQr: boolean;
  qrValue: string;
  qrPosition: SlotPosition;
  // Body
  accent: string;
  font: 'sans' | 'serif';
  paper: 'a4' | 'letter';
  margin: 'comfortable' | 'compact';
  // Footer
  footerLocation: string;
  footerAddress: string;
  footerTel: string;
  showPageNumbers: boolean;
  // Watermark
  watermarkMode: WatermarkMode;
  watermarkText: string;
  watermarkImage: string | null;
  watermarkTiled: boolean;
  // Signature
  signatureEnabled: boolean;
  signaturePosition: SignaturePosition;
  signatureImage: string | null;
  signatoryName: string;
  signatoryTitle: string;
  signatureRules: Record<PreviewDoc, boolean>;
}

export const DEFAULT_TEMPLATE: DocumentTemplate = {
  previewDoc: 'bill',
  logo: null,
  showLogo: true,
  logoPosition: 'start',
  companyName: 'Your Company Ltd',
  identityLines: 'Reg. No. RC-000000\nP. O. Box 0000, Accra\n+233 00 000 0000',
  showCompanyName: true,
  companyNamePosition: 'middle',
  showQr: true,
  qrValue: 'https://www.workphelo.com',
  qrPosition: 'end',
  accent: '#1e3a8a',
  font: 'sans',
  paper: 'a4',
  margin: 'comfortable',
  footerLocation: 'No. D17 Boundary Road, East Legon, Accra',
  footerAddress: 'P. O. Box MD2671, Madina - Accra',
  footerTel: '+233 (501) 605 643 / +233 (246) 923 436',
  showPageNumbers: true,
  watermarkMode: 'text',
  watermarkText: 'DRAFT',
  watermarkImage: null,
  watermarkTiled: false,
  signatureEnabled: true,
  signaturePosition: 'left',
  signatureImage: null,
  signatoryName: 'Ama Mensah',
  signatoryTitle: 'Authorized Signatory',
  signatureRules: {
    payslip: false,
    bill: false,
    invoice: false,
    'credit-note': false,
    'debit-note': false,
    'payment-receipt': false,
    'payment-voucher': false,
  },
};

export const SIGNATURE_POSITION_OPTIONS: { value: SignaturePosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export const SLOT_ORDER: SlotPosition[] = ['start', 'middle', 'end'];

export const SLOT_ALIGN: Record<SlotPosition, string> = {
  start: 'items-start text-left',
  middle: 'items-center text-center',
  end: 'items-end text-right',
};

export const POSITION_OPTIONS: { value: SlotPosition; label: string }[] = [
  { value: 'start', label: 'Start' },
  { value: 'middle', label: 'Middle' },
  { value: 'end', label: 'End' },
];

/** Split a multi-line string into trimmed, non-empty lines. */
export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

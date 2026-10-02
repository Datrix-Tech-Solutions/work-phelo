import type { jsPDF } from 'jspdf';

export const PAYROLL_DOCUMENT_DISCLAIMER =
  'The platform provider is not liable for data entry errors, misinterpretations of local tax codes, or unauthorized adjustments.';

export function addDisclaimerFooter(
  doc: jsPDF,
  notice: string,
  disclaimer: string = PAYROLL_DOCUMENT_DISCLAIMER,
): void {
  const lines = [notice, disclaimer].filter(Boolean);
  if (lines.length === 0) return;

  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const pageCount = doc.getNumberOfPages();
  const lineHeight = 3.5;
  const startY = pageH - 4 - (lines.length - 1) * lineHeight;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    lines.forEach((line, idx) => {
      doc.text(line, pageW / 2, startY + idx * lineHeight, { align: 'center' });
    });
  }
}

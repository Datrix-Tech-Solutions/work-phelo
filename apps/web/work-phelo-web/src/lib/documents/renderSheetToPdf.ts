import { waitForImages } from '@/lib/reinsurance/renderDocumentPdf';

const CAPTURE_SCALE = 2;
const PAGE_SIZES_MM = { a4: [210, 297], letter: [215.9, 279.4] } as const;

/**
 * Turns an on-screen document sheet (`[data-document-sheet]` under `root`) into a
 * one-page PDF that looks exactly like it. A sheet that has grown past the page is scaled
 * down to fit.
 */
export async function renderSheetToPdf(
  root: HTMLElement,
  { paper, title }: { paper: keyof typeof PAGE_SIZES_MM; title: string },
): Promise<Blob> {
  const sheet = root.querySelector<HTMLElement>('[data-document-sheet]');
  if (!sheet) throw new Error('Document sheet not found');

  await Promise.all([waitForImages(sheet), document.fonts.ready]);

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(sheet, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const [pageWidth, pageHeight] = PAGE_SIZES_MM[paper];
  const fit = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
  const width = canvas.width * fit;

  const pdf = new jsPDF({ unit: 'mm', format: paper, compress: true });
  pdf.setProperties({ title });
  pdf.addImage(canvas, 'PNG', (pageWidth - width) / 2, 0, width, canvas.height * fit);
  return pdf.output('blob');
}

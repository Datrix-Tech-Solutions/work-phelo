import type { DocumentTemplate } from '@/components/molecules/settings/document-template/templateConfig';
import { captureLetterhead } from './captureLetterhead';

const PLAIN_MARGIN_MM = 14;

/**
 * A tabular report PDF. With a template, every page carries the company's letterhead,
 * footer and watermark; without one it is a plain page headed by the company name. The
 * text stays real text, so it can be selected and searched.
 */
export async function createReportPdf({
  orientation,
  template,
}: {
  orientation: 'portrait' | 'landscape';
  template: DocumentTemplate | null;
}) {
  const [{ default: jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation, unit: 'mm', format: template?.paper ?? 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bands = template ? await captureLetterhead(template, pageWidth, pageHeight) : null;
  // jsPDF's built-in faces closest to the template's sans / serif choice.
  const font = template?.font === 'serif' ? 'times' : 'helvetica';

  const side = bands ? bands.paddingMm : PLAIN_MARGIN_MM;
  const headerHeight = bands?.header.heightMm ?? 0;
  const footerHeight = bands?.footer.heightMm ?? 0;
  const margin = {
    left: side,
    right: side,
    top: bands ? headerHeight + 4 : PLAIN_MARGIN_MM,
    bottom: bands ? footerHeight + 9 : 16,
  };

  /** Writes the report's title block on the first page; returns where the table starts. */
  const heading = (title: string, metaLines: string[], companyName: string) => {
    const centre = pageWidth / 2;
    let y = bands ? headerHeight + 8 : 16;
    doc.setFont(font, 'bold');
    // The letterhead already identifies the company.
    if (!bands && companyName) {
      doc.setFontSize(13);
      doc.text(companyName, centre, y, { align: 'center' });
      y += 7;
    }
    doc.setFontSize(16);
    doc.text(title, centre, y, { align: 'center' });
    y += 6;
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    for (const line of metaLines) {
      doc.text(line, centre, y, { align: 'center' });
      y += 5;
    }
    doc.setTextColor(0, 0, 0);
    return y + 3;
  };

  /** Stamps every page once the content is laid out, then downloads the file. */
  const save = (filename: string) => {
    const pages = doc.getNumberOfPages();
    const generated = `Generated ${new Date().toLocaleString()}`;
    const textY = pageHeight - (bands ? footerHeight + 3 : 8);

    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      if (bands) {
        // The alias stores each image once however many pages repeat it.
        const stamp = (image: HTMLCanvasElement, alias: string, y: number, height: number) =>
          doc.addImage(image, 'PNG', 0, y, pageWidth, height, alias, 'FAST');
        stamp(bands.header.image, 'letterhead', 0, headerHeight);
        stamp(bands.footer.image, 'footer', pageHeight - footerHeight, footerHeight);
        // Faint and transparent, so it sits over the table without hiding it.
        if (bands.watermark) stamp(bands.watermark, 'watermark', 0, pageHeight);
      }
      doc.setFont(font, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(generated, side, textY);
      if (!template || template.showPageNumbers) {
        doc.text(`Page ${page} of ${pages}`, pageWidth - side, textY, { align: 'right' });
      }
    }
    doc.save(`${filename}.pdf`);
  };

  return { doc, autoTable, font, margin, heading, save };
}

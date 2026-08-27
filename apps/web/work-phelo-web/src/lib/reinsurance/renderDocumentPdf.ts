const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 12;
const CAPTURE_SCALE = 2;
const WATERMARK_WIDTH_MM = 175;

async function captureElement(el: HTMLElement, transparent = false) {
  // Tailwind v4 emits colors as lab()/oklch() for modern browsers, which the
  // classic html2canvas can't parse — html2canvas-pro is a drop-in fork that
  // adds support for those color functions.
  const { default: html2canvas } = await import('html2canvas-pro');
  return html2canvas(el, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: transparent ? null : '#ffffff',
    logging: false,
  });
}

/** Waits for every <img> under `el` to finish loading so captures don't miss images. */
async function waitForImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

/**
 * Rasterizes a document's print layout (built by `DocumentPrintLayout`) into a
 * real, multi-page A4 PDF.
 *
 * Each page is stacked bottom-up: the faint watermark (`[data-print-watermark]`),
 * then the repeated header/footer bands, then a slice of the transparent content
 * canvas on top — so the watermark shows through the gaps in the text.
 * html2canvas can't replicate `position: fixed` elements across sliced pages, so
 * that repetition is done manually here.
 */
export async function renderPrintRootToPdf(root: HTMLElement, title: string): Promise<Blob> {
  const header = root.querySelector<HTMLElement>('[data-print-header]');
  const footer = root.querySelector<HTMLElement>('[data-print-footer]');
  const content = root.querySelector<HTMLElement>('[data-print-content]');
  const watermark =
    root.querySelector<HTMLElement>('[data-print-watermark] img') ??
    root.querySelector<HTMLElement>('[data-print-watermark]');
  if (!content) throw new Error('Print content not found');

  await waitForImages(root);

  // Fixed-position bands capture cleanly once un-pinned from the viewport; the
  // content block's viewport-relative minHeight (which pushes the sign-off to
  // the bottom of a *printed* page) only makes sense under @media print, so drop
  // it for a natural-height capture here.
  const prevHeaderPosition = header?.style.position ?? '';
  const prevFooterPosition = footer?.style.position ?? '';
  const prevWatermarkPosition = watermark?.style.position ?? '';
  const prevContentMinHeight = content.style.minHeight;
  if (header) header.style.position = 'static';
  if (footer) footer.style.position = 'static';
  if (watermark) watermark.style.position = 'static';
  content.style.minHeight = 'auto';

  let headerCanvas: HTMLCanvasElement | null = null;
  let footerCanvas: HTMLCanvasElement | null = null;
  let watermarkCanvas: HTMLCanvasElement | null = null;
  let contentCanvas: HTMLCanvasElement;
  try {
    [headerCanvas, footerCanvas, watermarkCanvas, contentCanvas] = await Promise.all([
      header ? captureElement(header) : Promise.resolve(null),
      footer ? captureElement(footer) : Promise.resolve(null),
      watermark ? captureElement(watermark, true) : Promise.resolve(null),
      captureElement(content, true),
    ]);
  } finally {
    if (header) header.style.position = prevHeaderPosition;
    if (footer) footer.style.position = prevFooterPosition;
    if (watermark) watermark.style.position = prevWatermarkPosition;
    content.style.minHeight = prevContentMinHeight;
  }

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({ title });

  const headerHmm = headerCanvas ? (headerCanvas.height / headerCanvas.width) * A4_WIDTH_MM : 0;
  const footerHmm = footerCanvas ? (footerCanvas.height / footerCanvas.width) * A4_WIDTH_MM : 0;
  const contentWmm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const contentAreaHmm = A4_HEIGHT_MM - headerHmm - footerHmm - PAGE_MARGIN_MM * 2;

  const watermarkWmm = watermarkCanvas ? WATERMARK_WIDTH_MM : 0;
  const watermarkHmm = watermarkCanvas
    ? (watermarkCanvas.height / watermarkCanvas.width) * WATERMARK_WIDTH_MM
    : 0;

  const pxPerMm = contentCanvas.width / contentWmm;
  const sliceHeightPx = Math.max(1, Math.floor(contentAreaHmm * pxPerMm));
  const totalPages = Math.max(1, Math.ceil(contentCanvas.height / sliceHeightPx));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    if (watermarkCanvas) {
      pdf.addImage(
        watermarkCanvas,
        'PNG',
        (A4_WIDTH_MM - watermarkWmm) / 2,
        (A4_HEIGHT_MM - watermarkHmm) / 2,
        watermarkWmm,
        watermarkHmm,
      );
    }

    if (headerCanvas) {
      pdf.addImage(headerCanvas, 'PNG', 0, 0, A4_WIDTH_MM, headerHmm);
    }
    if (footerCanvas) {
      pdf.addImage(footerCanvas, 'PNG', 0, A4_HEIGHT_MM - footerHmm, A4_WIDTH_MM, footerHmm);
    }

    const startPx = page * sliceHeightPx;
    const sliceHeightPxForPage = Math.min(sliceHeightPx, contentCanvas.height - startPx);
    if (sliceHeightPxForPage <= 0) continue;

    const slice = document.createElement('canvas');
    slice.width = contentCanvas.width;
    slice.height = sliceHeightPxForPage;
    const ctx = slice.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(
      contentCanvas,
      0,
      startPx,
      contentCanvas.width,
      sliceHeightPxForPage,
      0,
      0,
      contentCanvas.width,
      sliceHeightPxForPage,
    );

    const sliceHmm = sliceHeightPxForPage / pxPerMm;
    pdf.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      PAGE_MARGIN_MM,
      headerHmm + PAGE_MARGIN_MM,
      contentWmm,
      sliceHmm,
    );
  }

  return pdf.output('blob');
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 12;
const CAPTURE_SCALE = 2;

async function captureElement(el: HTMLElement) {
  // Tailwind v4 emits colors as lab()/oklch() for modern browsers, which the
  // classic html2canvas can't parse — html2canvas-pro is a drop-in fork that
  // adds support for those color functions.
  const { default: html2canvas } = await import('html2canvas-pro');
  return html2canvas(el, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
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
 * Rasterizes a document's print layout (`#irisk-print-root`, built by
 * `DocumentPrintLayout`) into a real, multi-page A4 PDF.
 *
 * The header and footer are captured once and stamped onto every generated
 * page — html2canvas can't replicate `position: fixed` elements across
 * sliced pages on its own the way a browser's print engine does, so that
 * repetition is done manually here instead.
 */
export async function renderPrintRootToPdf(root: HTMLElement, title: string): Promise<Blob> {
  const header = root.querySelector<HTMLElement>('[data-print-header]');
  const footer = root.querySelector<HTMLElement>('[data-print-footer]');
  const content = root.querySelector<HTMLElement>('[data-print-content]');
  if (!content) throw new Error('Print content not found');

  await waitForImages(root);

  // Fixed-position header/footer capture cleanly once un-pinned from the
  // viewport; the content block's viewport-relative minHeight (which pushes
  // the signature block to the bottom of a *printed* page) only makes sense
  // under @media print, so drop it for a natural-height capture here.
  const prevHeaderPosition = header?.style.position ?? '';
  const prevFooterPosition = footer?.style.position ?? '';
  const prevContentMinHeight = content.style.minHeight;
  if (header) header.style.position = 'static';
  if (footer) footer.style.position = 'static';
  content.style.minHeight = 'auto';

  let headerCanvas: HTMLCanvasElement | null = null;
  let footerCanvas: HTMLCanvasElement | null = null;
  let contentCanvas: HTMLCanvasElement;
  try {
    [headerCanvas, footerCanvas, contentCanvas] = await Promise.all([
      header ? captureElement(header) : Promise.resolve(null),
      footer ? captureElement(footer) : Promise.resolve(null),
      captureElement(content),
    ]);
  } finally {
    if (header) header.style.position = prevHeaderPosition;
    if (footer) footer.style.position = prevFooterPosition;
    content.style.minHeight = prevContentMinHeight;
  }

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({ title });

  const headerHmm = headerCanvas ? (headerCanvas.height / headerCanvas.width) * A4_WIDTH_MM : 0;
  const footerHmm = footerCanvas ? (footerCanvas.height / footerCanvas.width) * A4_WIDTH_MM : 0;
  const contentWmm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const contentAreaHmm = A4_HEIGHT_MM - headerHmm - footerHmm - PAGE_MARGIN_MM * 2;

  const pxPerMm = contentCanvas.width / contentWmm;
  const sliceHeightPx = Math.max(1, Math.floor(contentAreaHmm * pxPerMm));
  const totalPages = Math.max(1, Math.ceil(contentCanvas.height / sliceHeightPx));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

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

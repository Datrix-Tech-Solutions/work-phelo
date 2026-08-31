const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 12;
const CAPTURE_SCALE = 2;
const WATERMARK_WIDTH_MM = 175;
const STAGE_WIDTH_PX = 900;

function pdfFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim() || 'document';
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
}

/**
 * Shows `blob` in an already-opened tab as a clean, full-page PDF preview whose
 * *native* "Save as" proposes `fileName`. The browser only honours a filename
 * that comes from an HTTP response, so the PDF is round-tripped through
 * `/api/documents/preview` (which streams it back with `Content-Disposition`).
 * Falls back to a plain `blob:` URL (unnamed) if that request fails.
 */
export async function openPdfPreview(win: Window, blob: Blob, fileName: string) {
  const name = pdfFileName(fileName);
  try {
    const res = await fetch('/api/documents/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'X-Document-Name': encodeURIComponent(name),
      },
      body: blob,
    });
    if (!res.ok) throw new Error(`preview upload failed: ${res.status}`);
    const { id } = (await res.json()) as { id: string };
    if (win.closed) return;
    win.location.href = `/api/documents/preview/${id}/${encodeURIComponent(name)}`;
  } catch (error) {
    console.error('Named PDF preview unavailable, falling back to blob URL', error);
    if (!win.closed) win.location.href = URL.createObjectURL(blob);
  }
}

/**
 * Makes a `display:none` print root renderable for html2canvas while keeping it
 * completely off-screen. A `transform` on the root makes it the containing block
 * for its `position:fixed` letterhead/watermark, so the whole thing shifts out
 * of view instead of flashing as a full-screen overlay. Returns a restore fn.
 */
export function stagePrintRoot(el: HTMLElement): () => void {
  const prev = el.getAttribute('style') ?? '';
  Object.assign(el.style, {
    display: 'block',
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${STAGE_WIDTH_PX}px`,
    transform: 'translateX(-3000px)',
    pointerEvents: 'none',
    zIndex: '-1',
  } as Partial<CSSStyleDeclaration>);
  return () => {
    el.setAttribute('style', prev);
  };
}

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

/**
 * Vertical offsets within the captured content canvas (in canvas pixels) where a
 * page break may fall without slicing through a line of text or a keep-together
 * block. We take the top edge of every candidate block, then drop any that land
 * *inside* a block that must not be split — an explicit `[data-print-block]`, a
 * whole rich-text table (`[data-rich-text] table`), or anything with
 * `break-inside: avoid` — so a nested row/paragraph collapses onto its atomic
 * wrapper and that wrapper moves to the next page as one piece.
 *
 * Must run while the print root is still staged (laid out) and after the
 * content's print-only `minHeight` has been cleared, so offsets line up with the
 * captured canvas. Returns `[0]` if the content isn't measurable, which makes
 * the slicer fall back to fixed page-height cuts.
 */
function collectBreakOffsets(content: HTMLElement, canvasHeight: number): number[] {
  if (!content.offsetHeight) return [0];
  const scale = canvasHeight / content.offsetHeight;
  const contentTop = content.getBoundingClientRect().top;
  const toOffset = (clientTop: number) => (clientTop - contentTop) * scale;

  const candidates = Array.from(
    content.querySelectorAll<HTMLElement>('p, li, tr, h1, h2, h3, h4, h5, h6, [data-print-block]'),
  )
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.height > 0)
    .map((rect) => toOffset(rect.top));

  // Blocks that must never be sliced: explicit markers, whole tables authored in
  // the rich-text comment, and anything asking for `break-inside: avoid`.
  const atomicSelector = '[data-print-block], [data-rich-text] table';
  const atomicBoxes = Array.from(content.querySelectorAll<HTMLElement>('*'))
    .filter((el) => el.matches(atomicSelector) || getComputedStyle(el).breakInside === 'avoid')
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: toOffset(rect.top), bottom: toOffset(rect.bottom) };
    })
    .filter((box) => box.bottom - box.top > 2);

  const valid = candidates.filter(
    (offset) => !atomicBoxes.some((box) => offset > box.top + 1 && offset < box.bottom - 1),
  );

  return Array.from(new Set([0, ...valid.map((offset) => Math.round(offset))])).sort(
    (a, b) => a - b,
  );
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
  let breakOffsets: number[] = [0];
  try {
    [headerCanvas, footerCanvas, watermarkCanvas, contentCanvas] = await Promise.all([
      header ? captureElement(header) : Promise.resolve(null),
      footer ? captureElement(footer) : Promise.resolve(null),
      watermark ? captureElement(watermark, true) : Promise.resolve(null),
      captureElement(content, true),
    ]);
    // Measure now, while the root is still staged and `minHeight` is cleared.
    breakOffsets = collectBreakOffsets(content, contentCanvas.height);
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
  const maxSliceHeightPx = Math.max(1, Math.floor(contentAreaHmm * pxPerMm));

  // Turn the legal break offsets into concrete page boundaries: each page takes
  // as many whole blocks as fit in `maxSliceHeightPx`, snapping its bottom edge
  // to the largest break offset that fits. A block taller than a full page has
  // no legal break inside it, so it's hard-cut at the page height.
  const pageStarts = [0];
  let cursor = 0;
  while (cursor < contentCanvas.height) {
    const idealEnd = cursor + maxSliceHeightPx;
    if (idealEnd >= contentCanvas.height) break;
    let cut = idealEnd;
    for (const offset of breakOffsets) {
      if (offset > cursor && offset <= idealEnd) cut = offset;
      else if (offset > idealEnd) break;
    }
    if (cut <= cursor) cut = idealEnd;
    pageStarts.push(cut);
    cursor = cut;
  }

  for (let page = 0; page < pageStarts.length; page++) {
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

    const startPx = pageStarts[page];
    const endPx = page + 1 < pageStarts.length ? pageStarts[page + 1] : contentCanvas.height;
    const sliceHeightPxForPage = endPx - startPx;
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

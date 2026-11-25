import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DocumentFooter } from '@/components/molecules/settings/document-template/DocumentFooter';
import { DocumentLetterhead } from '@/components/molecules/settings/document-template/DocumentLetterhead';
import { DocumentWatermark } from '@/components/molecules/settings/document-template/DocumentWatermark';
import type { DocumentTemplate } from '@/components/molecules/settings/document-template/templateConfig';
import { waitForImages } from '@/lib/reinsurance/renderDocumentPdf';

/** The width of a portrait A4 sheet on screen; other pages keep the same px per mm, so the
 *  letterhead prints at the same physical size on every page shape. */
const A4_WIDTH_PX = 794;
const A4_WIDTH_MM = 210;
const PX_PER_MM = A4_WIDTH_PX / A4_WIDTH_MM;
/** Matches the text size of a document sheet at that width. */
const FONT_SIZE_PX = 21.4;
const PADDING_PX = { comfortable: 40, compact: 22 };
const CAPTURE_SCALE = 2;

export interface LetterheadBand {
  image: HTMLCanvasElement;
  heightMm: number;
}

export interface LetterheadBands {
  header: LetterheadBand;
  footer: LetterheadBand;
  /** A transparent full page, or null when the template has no watermark. */
  watermark: HTMLCanvasElement | null;
  /** The template's page padding, for lining content up with the letterhead. */
  paddingMm: number;
}

/** Draws the saved template's letterhead, footer and watermark off-screen and captures them
 *  as images that can be stamped on every page of a generated PDF. */
export async function captureLetterhead(
  template: DocumentTemplate,
  pageWidthMm: number,
  pageHeightMm: number,
): Promise<LetterheadBands> {
  const width = Math.round(pageWidthMm * PX_PER_MM);
  const height = Math.round(pageHeightMm * PX_PER_MM);
  const padding = PADDING_PX[template.margin];

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    left: '-10000px',
    width: `${width}px`,
    pointerEvents: 'none',
    color: '#111827',
    fontSize: `${FONT_SIZE_PX}px`,
    fontFamily:
      template.font === 'serif'
        ? 'Georgia, "Times New Roman", serif'
        : 'var(--font-app), system-ui, sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() =>
      root.render(
        <>
          <div data-band="header" style={{ padding: `${padding}px ${padding}px 0` }}>
            <DocumentLetterhead template={template} />
          </div>
          {/* Page numbers are written by the PDF itself, which knows the page count. */}
          <div data-band="footer" style={{ padding: `0 ${padding}px ${padding / 2}px` }}>
            <DocumentFooter template={{ ...template, showPageNumbers: false }} />
          </div>
          <div data-band="watermark" style={{ position: 'relative', width, height }}>
            <DocumentWatermark template={template} />
          </div>
        </>,
      ),
    );
    await Promise.all([waitForImages(host), document.fonts.ready]);

    const { default: html2canvas } = await import('html2canvas-pro');
    const capture = (name: string, backgroundColor: string | null) => {
      const element = host.querySelector<HTMLElement>(`[data-band="${name}"]`);
      if (!element) throw new Error(`Letterhead ${name} not found`);
      return html2canvas(element, {
        scale: CAPTURE_SCALE,
        useCORS: true,
        backgroundColor,
        logging: false,
      });
    };
    const band = async (name: string): Promise<LetterheadBand> => {
      const image = await capture(name, '#ffffff');
      return { image, heightMm: (image.height / image.width) * pageWidthMm };
    };

    const hasWatermark =
      template.watermarkMode === 'text' ||
      (template.watermarkMode === 'image' && Boolean(template.watermarkImage));

    return {
      header: await band('header'),
      footer: await band('footer'),
      watermark: hasWatermark ? await capture('watermark', null) : null,
      paddingMm: padding / PX_PER_MM,
    };
  } finally {
    root.unmount();
    host.remove();
  }
}

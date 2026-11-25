'use client';

import type { ReactNode } from 'react';
import { DocumentWatermark } from './DocumentWatermark';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentBody } from './DocumentBody';
import { DocumentFooter } from './DocumentFooter';
import type { DocumentTemplate } from './templateConfig';

/** The A4/Letter sheet: watermark layer plus letterhead → content → footer.
 *  Text scales with the sheet width via a container query. Without `children` it shows
 *  the studio's sample document. */
export function DocumentPaper({
  template,
  children,
}: {
  template: DocumentTemplate;
  children?: ReactNode;
}) {
  const ratio = template.paper === 'a4' ? '1 / 1.4142' : '1 / 1.2941';
  const padding =
    template.margin === 'compact' ? 'clamp(12px, 4%, 22px)' : 'clamp(16px, 6.5%, 40px)';
  const fontFamily =
    template.font === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : 'var(--font-app), system-ui, sans-serif';

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* `data-document-sheet` marks what the PDF captures. The ratio is a minimum: real
          content taller than a page grows the sheet rather than being cut off. */}
      <div
        data-document-sheet
        className="relative flex w-full flex-col bg-white @container"
        style={{ aspectRatio: ratio }}
      >
        <DocumentWatermark template={template} />
        <div
          className="relative z-10 flex flex-1 flex-col"
          style={{
            padding,
            fontFamily,
            color: '#111827',
            fontSize: 'clamp(9px, 2.7cqw, 22px)',
          }}
        >
          <DocumentLetterhead template={template} />
          {children ?? <DocumentBody template={template} />}
          <DocumentFooter template={template} />
        </div>
      </div>
    </div>
  );
}

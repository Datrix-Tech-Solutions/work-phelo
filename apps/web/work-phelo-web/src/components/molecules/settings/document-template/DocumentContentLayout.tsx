'use client';

/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from 'react';
import type { DocumentTemplate } from './templateConfig';

function SignatureBlock({ template }: { template: DocumentTemplate }) {
  const alignEnd = template.signaturePosition === 'right';
  return (
    <div
      className={`mt-[1.6em] flex flex-col ${
        alignEnd ? 'items-end text-right' : 'items-start text-left'
      }`}
    >
      {template.signatureImage ? (
        <img
          src={template.signatureImage}
          alt=""
          className="h-[4em] w-auto max-w-[14em] object-contain"
        />
      ) : (
        <div className="h-[3.4em] w-[14em] border-b border-gray-400" />
      )}
      <p className="mt-[0.4em] text-[0.82em] font-semibold text-gray-800">
        {template.signatoryName || 'Authorized Signatory'}
      </p>
      <p className="text-[0.72em] text-gray-500">{template.signatoryTitle || 'Title'}</p>
    </div>
  );
}

/** A document's content between the letterhead and the footer, plus the signature block
 *  when this document type requires one. */
export function DocumentContentLayout({
  template,
  documentKey,
  footerNote,
  children,
}: {
  template: DocumentTemplate;
  documentKey: DocumentTemplate['previewDoc'];
  footerNote?: ReactNode;
  children: ReactNode;
}) {
  const showSignature = template.signatureEnabled && template.signatureRules[documentKey];

  return (
    <div className="flex flex-1 flex-col pt-[1.4em]">
      {/* The signature follows the document's content directly, and the closing note is pinned
          to the bottom, just above the footer line. */}
      <div>{children}</div>
      {showSignature && (
        <div className="shrink-0">
          <SignatureBlock template={template} />
        </div>
      )}
      <div className="flex-1" />
      {footerNote && <div className="shrink-0 pt-[0.6em]">{footerNote}</div>}
    </div>
  );
}

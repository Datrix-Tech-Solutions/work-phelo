'use client';

import type { ReactNode } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { renderPrintRootToPdf } from '@/lib/reinsurance/renderDocumentPdf';
import { DocumentPrintLayout } from '@/components/organisms/reinsurance/documents/DocumentPrintLayout';

interface DocumentPreviewShellProps {
  isOpen: boolean;
  title: string;
  /** Unique id for this document type's hidden print root. */
  printRootId: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Shared modal for a content-only document preview. The modal shows the bare
 * document body; Print composes it into the full branded page — letterhead,
 * footer and watermark from `DocumentPrintLayout` — and renders that to a
 * paginated PDF in a new tab.
 */
export function DocumentPreviewShell({
  isOpen,
  title,
  printRootId,
  onClose,
  children,
}: DocumentPreviewShellProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  const printTitle = title.replace(/\s*—\s*/, ' - ');

  const handlePrint = () => {
    const el = document.getElementById(printRootId);
    if (!el) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      el.style.display = 'block';
      const previousTitle = document.title;
      document.title = printTitle;
      window.print();
      document.title = previousTitle;
      el.style.display = 'none';
      return;
    }

    printWindow.document.title = printTitle;
    printWindow.document.body.innerHTML =
      '<p style="font-family: sans-serif; padding: 24px; color: #6b7280;">Preparing document…</p>';

    el.style.display = 'block';
    renderPrintRootToPdf(el, printTitle)
      .then((blob) => {
        if (printWindow.closed) return;
        printWindow.location.href = URL.createObjectURL(blob);
      })
      .catch((error) => {
        console.error('Failed to generate document PDF', error);
        if (!printWindow.closed) {
          printWindow.document.body.innerHTML =
            '<p style="font-family: sans-serif; padding: 24px; color: #b91c1c;">Could not generate the document. Please try again.</p>';
        }
      })
      .finally(() => {
        el.style.display = 'none';
      });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        width="sm:w-[44vw] sm:max-w-[44vw]"
        height="sm:h-[88vh] sm:max-h-[88vh]"
        fullScreenMobile
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handlePrint}>Print</Button>
          </>
        }
      >
        <div className="pt-2">{children}</div>
      </Modal>

      <DocumentPrintLayout rootId={printRootId} documentTitle={printTitle} afterContent={null}>
        {children}
      </DocumentPrintLayout>
    </>
  );
}

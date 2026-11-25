'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { AccountingDocumentSheet } from '@/components/molecules/accounting/documents/AccountingDocumentSheet';
import { useTenantDocumentRender } from '@/hooks/useTenantDocumentTemplate';
import { useToast } from '@/hooks/useToast';
import { buildDocumentTemplate } from '@/lib/accounting/documentTemplate';
import {
  accountingDocumentLabel,
  buildTradeDocumentData,
  type AccountingDocumentKey,
} from '@/lib/accounting/documents';
import { renderSheetToPdf } from '@/lib/documents/renderSheetToPdf';
import { openPdfPreview, preloadDocumentPdfDeps } from '@/lib/reinsurance/renderDocumentPdf';
import { useAuthStore } from '@/store/auth.store';
import type { AccountingTradeDocument } from '@/types/accounting';

export interface DocumentPreviewTarget {
  document: AccountingTradeDocument;
  documentKey: AccountingDocumentKey;
}

/** Width the PDF is captured at (A4 at 96dpi), so the file doesn't depend on screen size. */
const PRINT_WIDTH_PX = 794;

/** A transaction as the document its Transaction Type allows, on the company's saved
 *  template, with PDF download and print. Documents that aren't final carry a watermark so
 *  one is never mistaken for the final document. */
export function DocumentPreviewPanel({
  target,
  onClose,
}: {
  target: DocumentPreviewTarget | null;
  onClose: () => void;
}) {
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const toast = useToast();
  const render = useTenantDocumentRender(tenantId, target !== null);
  const printRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);

  useEffect(() => {
    if (target) preloadDocumentPdfDeps();
  }, [target]);

  const data = useMemo(() => (target ? buildTradeDocumentData(target.document) : null), [target]);
  const template = useMemo(
    () =>
      render.data && data && tenantId
        ? buildDocumentTemplate(render.data, {
            tenantId,
            status: data.status,
            version: render.dataUpdatedAt,
          })
        : null,
    [render.data, render.dataUpdatedAt, data, tenantId],
  );

  const label = target ? accountingDocumentLabel(target.documentKey) : 'Document';
  const fileName = data ? `${label}_${data.documentNumber}_${data.party.name}` : label;
  // A template still being refetched may be out of date, so wait for it before exporting.
  const ready = Boolean(template) && !render.isFetching;

  const exportPdf = async (action: 'download' | 'print') => {
    const root = printRef.current;
    if (!root || !template || busy) return;
    // Open the tab synchronously so popup blockers treat it as click-driven.
    const printWindow = action === 'print' ? window.open('', '_blank') : null;
    if (action === 'print' && !printWindow) {
      toast.error('Allow pop-ups for this site to print the document');
      return;
    }
    if (printWindow) printWindow.document.title = fileName;

    setBusy(action);
    try {
      const blob = await renderSheetToPdf(root, { paper: template.paper, title: fileName });
      if (printWindow) {
        if (!printWindow.closed) await openPdfPreview(printWindow, blob, fileName);
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim()}.pdf`;
        link.click();
        // Revoked a moment later so the browser has started the download.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      console.error('Failed to generate document PDF', error);
      printWindow?.close();
      toast.error('Could not generate the document. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const sheet =
    target && data && template ? (
      <AccountingDocumentSheet documentKey={target.documentKey} data={data} template={template} />
    ) : null;

  return (
    <>
      <SidePanel
        isOpen={target !== null}
        onClose={onClose}
        title={target ? `${label} Preview` : 'Document'}
        description={target?.document.documentNumber}
        width="sm:w-[860px]"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => exportPdf('print')}
              disabled={!ready || busy !== null}
              isLoading={busy === 'print'}
              loadingText="Preparing…"
            >
              Print
            </Button>
            <Button
              onClick={() => exportPdf('download')}
              disabled={!ready || busy !== null}
              isLoading={busy === 'download'}
              loadingText="Preparing…"
              icon={<Icons.Download className="w-4 h-4" />}
            >
              Download PDF
            </Button>
          </div>
        }
      >
        {target && (
          <div className="bg-gray-50 p-2 sm:p-4">
            {sheet ? (
              <div className="mx-auto w-full max-w-[794px]">{sheet}</div>
            ) : render.isError ? (
              <p className="py-6 text-center text-sm text-red-700">
                Could not load the document template. Close this panel and try again.
              </p>
            ) : (
              <p className="py-6 text-center text-sm text-gray-500">Loading document…</p>
            )}
          </div>
        )}
      </SidePanel>

      {/* Off-screen copy at a fixed width — this is what the PDF captures. */}
      {sheet &&
        createPortal(
          <div
            ref={printRef}
            aria-hidden
            className="pointer-events-none fixed top-0 -left-[10000px]"
            style={{ width: PRINT_WIDTH_PX }}
          >
            {sheet}
          </div>,
          document.body,
        )}
    </>
  );
}

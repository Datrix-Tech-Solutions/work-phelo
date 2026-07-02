'use client';

import { ReactNode } from 'react';
import QRCode from 'react-qr-code';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DocumentPrintLayout } from '@/components/organisms/reinsurance/documents/DocumentPrintLayout';
import { usePublicTenantBranding } from '@/hooks/useTenants';
import { useAuthStore } from '@/store/auth.store';

const COMPANY_URL = 'https://app.workphelo.com';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  title: string;
  documentTitle: string;
  onPrint: () => void;
  onClose: () => void;
  children: ReactNode;
  afterContent?: ReactNode;
  previewOnly?: boolean;
}

export function DocumentPreviewModal({
  isOpen,
  title,
  documentTitle,
  onPrint,
  onClose,
  children,
  afterContent,
  previewOnly = false,
}: DocumentPreviewModalProps) {
  const user = useAuthStore((state) => state.user);
  const { data: tenantBranding } = usePublicTenantBranding(user?.tenantSlug ?? '');
  const legacyLogoUrl =
    !tenantBranding?.logoDisplayUrl &&
    /irisk/i.test(`${user?.tenantSlug ?? ''} ${user?.tenantName ?? ''}`)
      ? '/iriskre.png'
      : null;
  const branding = {
    tenantName: tenantBranding?.tenantName ?? user?.tenantName ?? 'WorkPhelo',
    logoUrl: tenantBranding?.logoDisplayUrl ?? legacyLogoUrl,
    documentHeaderColor: tenantBranding?.documentHeaderColor ?? '#173f5f',
  };
  const handlePrint = () => {
    const el = document.getElementById('workphelo-print-root');
    if (el) el.style.display = 'block';
    window.print();
    if (el) el.style.display = 'none';
    onPrint();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        width="sm:w-[40vw] sm:max-w-[40vw]"
        height="sm:h-[90vh] sm:max-h-[90vh]"
        fullScreenMobile
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Close Preview
            </Button>
            <Button onClick={handlePrint}>Print</Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {previewOnly && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Preview only. This document has not been generated or stored by the backend yet.
            </div>
          )}

          <div className="grid grid-cols-3 items-center pb-2 border-b border-gray-100">
            {branding.logoUrl ? (
              <div
                role="img"
                aria-label={`${branding.tenantName} logo`}
                className="h-14 w-32 bg-contain bg-left bg-no-repeat justify-self-start"
                style={{ backgroundImage: `url("${branding.logoUrl}")` }}
              />
            ) : (
              <div
                className="flex items-center gap-2 justify-self-start"
                style={{ color: branding.documentHeaderColor }}
              >
                <div
                  className="flex h-10 w-9 items-center justify-center rounded-b-xl text-sm font-extrabold text-[#d6a84b]"
                  style={{ backgroundColor: branding.documentHeaderColor }}
                >
                  W
                </div>
                <div>
                  <div className="text-sm font-extrabold">{branding.tenantName}</div>
                  <div className="text-[8px] uppercase tracking-wider text-slate-500">
                    Reinsurance
                  </div>
                </div>
              </div>
            )}
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide text-center">
              {documentTitle}
            </h2>
            <div className="flex flex-col items-center gap-1 justify-self-end">
              <QRCode value={COMPANY_URL} size={56} />
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <div className="w-full max-w-lg">{children}</div>
          </div>
        </div>
      </Modal>

      {isOpen && (
        <DocumentPrintLayout
          documentTitle={documentTitle}
          afterContent={afterContent}
          branding={branding}
        >
          {children}
        </DocumentPrintLayout>
      )}
    </>
  );
}

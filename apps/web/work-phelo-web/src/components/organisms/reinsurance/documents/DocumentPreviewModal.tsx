'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CompanyLogo } from '@/components/atoms/CompanyLogo';
import { DocumentPrintLayout } from '@/components/organisms/reinsurance/documents/DocumentPrintLayout';

const COMPANY_URL = 'https://iriskmanagement.net/reinsurance/';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  title: string;
  documentTitle: string;
  /** Name used for the saved PDF when printing — e.g. "Debit Note-POL123-Acme Ltd". Falls back to documentTitle. */
  fileName?: string;
  logoSrc?: string | null;
  companyName?: string | null;
  qrValue?: string;
  onPrint: () => void;
  onClose: () => void;
  children: ReactNode;
  afterContent?: ReactNode;
}

export function DocumentPreviewModal({
  isOpen,
  title,
  documentTitle,
  fileName,
  logoSrc,
  companyName,
  qrValue = COMPANY_URL,
  onPrint,
  onClose,
  children,
  afterContent,
}: DocumentPreviewModalProps) {
  const handlePrint = () => {
    const el = document.getElementById('irisk-print-root');
    if (el) el.style.display = 'block';
    const previousTitle = document.title;
    document.title = fileName ?? documentTitle;
    window.print();
    document.title = previousTitle;
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
          <div className="grid grid-cols-3 items-center pb-2 border-b border-gray-100">
            {logoSrc ? (
              <Image
                src={logoSrc}
                alt={companyName ?? 'Company logo'}
                width={120}
                height={60}
                className="object-contain justify-self-start max-h-15"
                unoptimized
              />
            ) : (
              <CompanyLogo
                width={120}
                height={60}
                className="object-contain justify-self-start"
                priority
              />
            )}
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide text-center">
              {documentTitle}
            </h2>
            <div className="flex flex-col items-center gap-1 justify-self-end">
              <QRCode value={qrValue} size={56} />
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <div className="w-full max-w-lg">{children}</div>
          </div>
        </div>
      </Modal>

      {isOpen && (
        <DocumentPrintLayout documentTitle={documentTitle} afterContent={afterContent}>
          {children}
        </DocumentPrintLayout>
      )}
    </>
  );
}

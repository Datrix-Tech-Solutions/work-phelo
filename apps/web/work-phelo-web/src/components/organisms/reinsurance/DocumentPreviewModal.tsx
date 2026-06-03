'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DocumentPrintLayout } from '@/components/organisms/reinsurance/DocumentPrintLayout';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  title: string;
  documentTitle: string;
  onPrint: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function DocumentPreviewModal({
  isOpen,
  title,
  documentTitle,
  onPrint,
  onClose,
  children,
}: DocumentPreviewModalProps) {
  const handlePrint = () => {
    const el = document.getElementById('irisk-print-root');
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-center gap-3 pb-4 border-b border-gray-100">
            <Image
              src="/iRisklogo.png"
              alt="iRisk logo"
              width={200}
              height={150}
              className="object-contain"
            />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              {documentTitle}
            </h2>
          </div>

          {children}
        </div>
      </Modal>

      {isOpen && (
        <DocumentPrintLayout documentTitle={documentTitle}>{children}</DocumentPrintLayout>
      )}
    </>
  );
}

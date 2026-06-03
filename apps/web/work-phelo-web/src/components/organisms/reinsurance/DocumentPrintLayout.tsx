'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import QRCode from 'react-qr-code';

const COMPANY_URL = 'https://iriskmanagement.net/reinsurance/';

const FOOTER_LINES = [
  'Location: No. D17 Boundary Road, Near Kaiser Kitchen Appliances, East Legon, Accra',
  'Address: P. O. Box MD2671, Madina - Accra',
  'Tel: +233 (501) 605 643 / +233 (246) 923 436',
];

interface DocumentPrintLayoutProps {
  documentTitle: string;
  children: ReactNode;
}

export function DocumentPrintLayout({ documentTitle, children }: DocumentPrintLayoutProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="irisk-print-root"
      style={{ display: 'none' }}
      className="bg-white font-sans text-sm text-gray-900"
    >
      {/* Watermark */}
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <Image
          src="/iRiskwatermark.png"
          alt=""
          width={600}
          height={600}
          className="object-contain opacity-30"
        />
      </div>

      {/* Page content */}
      <div className="relative min-h-screen flex flex-col p-12" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
          <Image
            src="/iRisklogo.png"
            alt="iRisk logo"
            width={160}
            height={80}
            className="object-contain"
          />
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-lg font-bold uppercase tracking-widest text-gray-900">
              {documentTitle}
            </h1>
          </div>
          <div className="flex flex-col items-center gap-1">
            <QRCode value={COMPANY_URL} size={72} />
          </div>
        </div>

        {/* Document body */}
        <div className="flex-1">{children}</div>

        {/* Acceptance section */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col gap-4">
          <p className="text-sm text-gray-700 italic">
            Kindly confirm your acceptance or otherwise
          </p>
          <div className="flex gap-16">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Accepted by</span>
              <div className="w-56 border-b border-gray-400 mt-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Signature</span>
              <div className="w-56 border-b border-gray-400 mt-6" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col items-center gap-1">
          {FOOTER_LINES.map((line) => (
            <p key={line} className="text-[10px] text-gray-500 text-center">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

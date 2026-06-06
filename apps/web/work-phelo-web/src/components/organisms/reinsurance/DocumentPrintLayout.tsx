'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import QRCode from 'react-qr-code';

const COMPANY_URL = 'https://iriskmanagement.net/reinsurance/';
const HEADER_H = 100; // px — must match the fixed header height
const FOOTER_H = 56; // px — must match the fixed footer height

const FOOTER_LINES = [
  'Location: No. D17 Boundary Road, Near Kaiser Kitchen Appliances, East Legon, Accra',
  'Address: P. O. Box MD2671, Madina - Accra',
  'Tel: +233 (501) 605 643 / +233 (246) 923 436',
];

interface DocumentPrintLayoutProps {
  documentTitle: string;
  children: ReactNode;
  afterContent?: ReactNode;
}

export function DocumentPrintLayout({
  documentTitle,
  children,
  afterContent,
}: DocumentPrintLayoutProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="irisk-print-root"
      style={{ display: 'none', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* Watermark */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <Image
          src="/iRiskwatermark.png"
          alt=""
          width={900}
          height={600}
          style={{ objectFit: 'contain', opacity: 0.3 }}
          priority
        />
      </div>

      {/* Fixed header — repeats on every page */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${HEADER_H}px`,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '12px 48px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          zIndex: 2,
        }}
      >
        <Image
          src="/iriskre.png"
          alt="iRisk logo"
          width={130}
          height={65}
          style={{ objectFit: 'contain' }}
          priority
        />
        <h1
          style={{
            fontSize: '14px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#111827',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {documentTitle}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <QRCode value={COMPANY_URL} size={60} />
        </div>
      </div>

      {/* Fixed footer — sticks to bottom of every page */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${FOOTER_H}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          borderTop: '1px solid #f3f4f6',
          backgroundColor: 'white',
          padding: '6px 48px',
          zIndex: 2,
        }}
      >
        {FOOTER_LINES.map((line) => (
          <p
            key={line}
            style={{ fontSize: '9px', color: '#6b7280', margin: 0, textAlign: 'center' }}
          >
            {line}
          </p>
        ))}
      </div>

      {/*
        Table with transparent thead/tfoot spacers — these reserve exactly the
        same height as the fixed header/footer on every page, so content never
        flows behind them.
      */}
      <table style={{ width: '100%', borderCollapse: 'collapse', position: 'relative', zIndex: 1 }}>
        <thead>
          <tr>
            <td style={{ height: `${HEADER_H}px`, padding: 0 }} />
          </tr>
        </thead>

        <tfoot>
          <tr>
            <td style={{ height: `${FOOTER_H}px`, padding: 0 }} />
          </tr>
        </tfoot>

        <tbody>
          <tr>
            <td style={{ padding: '16px 48px 0' }}>
              <div>{children}</div>

              {afterContent ?? (
                <div
                  style={{
                    marginTop: '48px',
                    paddingTop: '24px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <p style={{ fontSize: '14px', color: '#374151', fontStyle: 'italic', margin: 0 }}>
                    Kindly confirm your acceptance or otherwise
                  </p>
                  <div style={{ display: 'flex', gap: '64px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>Accepted by</span>
                      <div
                        style={{
                          width: '224px',
                          borderBottom: '1px solid #9ca3af',
                          marginTop: '24px',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>Signature</span>
                      <div
                        style={{
                          width: '224px',
                          borderBottom: '1px solid #9ca3af',
                          marginTop: '24px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
}

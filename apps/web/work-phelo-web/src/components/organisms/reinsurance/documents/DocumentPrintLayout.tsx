'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { CompanyLogo } from '@/components/atoms/CompanyLogo';

const COMPANY_URL = 'https://iriskmanagement.net/reinsurance/';
const HEADER_H = 100; // px — must match the fixed header height
const FOOTER_H = 56; // px — must match the fixed footer height
const PAGE_GAP = 32; // px — breathing room below header on every printed page

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

export function DocumentPrintLayout({ children, afterContent }: DocumentPrintLayoutProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="irisk-print-root"
      style={{ display: 'none', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* Watermark */}
      <div
        data-print-watermark
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
          src="/iRiskrewatermark.png"
          alt=""
          width={400}
          height={250}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      {/* Fixed header — repeats on every page */}
      <div
        data-print-header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${HEADER_H}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '12px 48px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          zIndex: 2,
        }}
      >
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <CompanyLogo width={130} height={65} style={{ objectFit: 'contain' }} priority />
        </div>
        <QRCode value={COMPANY_URL} size={60} />
      </div>

      {/* Fixed footer — sticks to bottom of every page */}
      <div
        data-print-footer
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
          fontFamily: 'var(--font-app), sans-serif',
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
            <td style={{ height: `${HEADER_H + PAGE_GAP}px`, padding: 0 }} />
          </tr>
        </thead>

        <tfoot>
          <tr>
            <td style={{ height: `${FOOTER_H}px`, padding: 0 }} />
          </tr>
        </tfoot>

        <tbody>
          <tr>
            <td style={{ padding: '0 48px', verticalAlign: 'top' }}>
              <div
                data-print-content
                style={{
                  maxWidth: '640px',
                  margin: '0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: `calc(100vh - ${HEADER_H + PAGE_GAP + FOOTER_H}px)`,
                }}
              >
                <div>{children}</div>

                <div style={{ marginTop: 'auto', paddingTop: '64px', paddingBottom: '40px' }}>
                  {afterContent !== undefined ? (
                    afterContent
                  ) : (
                    <div
                      style={{
                        paddingTop: '24px',
                        borderTop: '1px solid #e5e7eb',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '16px',
                          color: '#374151',
                          fontStyle: 'italic',
                          margin: 0,
                        }}
                      >
                        Kindly confirm your acceptance or otherwise
                      </p>
                      <div style={{ display: 'flex', gap: '50px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '10px', color: '#6b7280' }}>Accepted by</span>
                          <div
                            style={{
                              width: '224px',
                              borderBottom: '1px solid #9ca3af',
                              marginTop: '50px',
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '10px', color: '#6b7280' }}>Signature</span>
                          <div
                            style={{
                              width: '224px',
                              borderBottom: '1px solid #9ca3af',
                              marginTop: '50px',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
}

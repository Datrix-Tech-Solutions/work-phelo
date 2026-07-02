'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';

const COMPANY_URL = 'https://app.workphelo.com';
const HEADER_H = 100; // px — must match the fixed header height
const FOOTER_H = 56; // px — must match the fixed footer height
const PAGE_GAP = 32; // px — breathing room below header on every printed page

interface DocumentPrintLayoutProps {
  documentTitle: string;
  children: ReactNode;
  afterContent?: ReactNode;
  branding?: {
    tenantName: string;
    logoUrl: string | null;
    documentHeaderColor: string;
  };
}

export function DocumentPrintLayout({
  documentTitle,
  children,
  afterContent,
  branding,
}: DocumentPrintLayoutProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="workphelo-print-root"
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
        {branding?.logoUrl ? (
          <div
            style={{
              width: '420px',
              height: '360px',
              backgroundImage: `url("${branding.logoUrl}")`,
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'contain',
              opacity: 0.08,
            }}
          />
        ) : (
          <div
            style={{
              width: '280px',
              height: '320px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '48% 48% 58% 58%',
              backgroundColor: '#173f5f',
              color: '#d6a84b',
              fontSize: '120px',
              fontWeight: 800,
              opacity: 0.06,
            }}
          >
            W
          </div>
        )}
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
        {branding?.logoUrl ? (
          <div
            aria-label={`${branding.tenantName} logo`}
            style={{
              width: '130px',
              height: '65px',
              backgroundImage: `url("${branding.logoUrl}")`,
              backgroundPosition: 'left center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'contain',
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#173f5f' }}>
            <div
              style={{
                width: '36px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '45% 45% 55% 55%',
                backgroundColor: '#173f5f',
                color: '#d6a84b',
                fontWeight: 800,
              }}
            >
              W
            </div>
            <strong>{branding?.tenantName ?? 'WorkPhelo'}</strong>
          </div>
        )}
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
        {[branding?.tenantName ?? 'WorkPhelo', 'Reinsurance Operations'].map((line) => (
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
                          fontSize: '14px',
                          color: '#374151',
                          fontStyle: 'italic',
                          margin: 0,
                        }}
                      >
                        Kindly confirm your acceptance or otherwise
                      </p>
                      <div style={{ display: 'flex', gap: '70px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '10px', color: '#6b7280' }}>Accepted by</span>
                          <div
                            style={{
                              width: '224px',
                              borderBottom: '1px solid #9ca3af',
                              marginTop: '72px',
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '10px', color: '#6b7280' }}>Signature</span>
                          <div
                            style={{
                              width: '224px',
                              borderBottom: '1px solid #9ca3af',
                              marginTop: '72px',
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

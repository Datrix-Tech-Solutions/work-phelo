'use client';

import type { CSSProperties, ReactNode } from 'react';
import { documentRootStyle } from './documentTypography';

const titleStyle: CSSProperties = {
  fontFamily: 'var(--doc-font-title)',
  fontWeight: 700,
  fontSize: '1.4em',
  letterSpacing: '0.06em',
};

const metaStyle: CSSProperties = {
  fontFamily: 'var(--doc-font-content)',
  fontSize: '0.8em',
};

const sectionHeaderStyle: CSSProperties = {
  fontFamily: 'var(--doc-font-header)',
  fontWeight: 700,
  fontSize: '0.78em',
  letterSpacing: '0.09em',
  marginTop: 'var(--doc-space-section)',
  marginBottom: 'var(--doc-space-row)',
};

const fieldRowStyle: CSSProperties = {
  paddingTop: 'var(--doc-space-row)',
  paddingBottom: 'var(--doc-space-row)',
  columnGap: 'var(--doc-space-inline)',
  fontFamily: 'var(--doc-font-content)',
};

interface DocumentContentFrameProps {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}

export function DocumentContentFrame({ title, meta, children }: DocumentContentFrameProps) {
  return (
    <div className="@container mx-auto w-full max-w-184 text-gray-900" style={documentRootStyle}>
      <div className="flex flex-col" style={{ fontSize: 'clamp(11px, 3.3cqw, 16px)' }}>
        <h2 className="text-center uppercase" style={titleStyle}>
          {title}
        </h2>
        {meta ? (
          <p className="mt-[0.5em] text-center text-gray-500" style={metaStyle}>
            {meta}
          </p>
        ) : null}
        <div className="flex flex-col" style={{ marginTop: 'var(--doc-space-section)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A section label inside a document body ("Risk Details", "Financials"). */
export function DocumentSectionHeader({ children }: { children: ReactNode }) {
  return (
    <p className="uppercase text-gray-500" style={sectionHeaderStyle}>
      {children}
    </p>
  );
}

/**
 * A label / value line for a plain (non-table) list: no separating rule, and the
 * value starts at the midpoint rather than the far edge. Renders nothing when
 * the value is empty.
 */
export function DocumentField({
  label,
  value,
  strong,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className="grid grid-cols-2 items-baseline" style={fieldRowStyle}>
      <span className="text-gray-500">{label}</span>
      <span className={strong ? 'font-semibold text-gray-900' : 'text-gray-800'}>{value}</span>
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--doc-font-header)',
  fontWeight: 700,
  fontSize: '0.72em',
  letterSpacing: '0.06em',
};

/**
 * The issue header shared by notes and receipts: a reference number and the date
 * on one row (eyebrow label above value), then the party the document is
 * addressed to with an optional location line.
 */
export function DocumentIssueHeader({
  referenceLabel,
  reference,
  date,
  partyLabel,
  partyName,
  partyLocation,
}: {
  referenceLabel: string;
  reference: ReactNode;
  date: ReactNode;
  partyLabel: string;
  partyName: ReactNode;
  partyLocation?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[1em]" style={{ fontFamily: 'var(--doc-font-content)' }}>
      <div className="flex items-start justify-between gap-(--doc-space-inline)">
        <div>
          <span className="block uppercase text-gray-400" style={eyebrowStyle}>
            {referenceLabel}
          </span>
          <p className="font-semibold text-gray-900">{reference}</p>
        </div>
        <div className="text-right">
          <span className="block uppercase text-gray-400" style={eyebrowStyle}>
            Date
          </span>
          <p className="font-semibold text-gray-900">{date}</p>
        </div>
      </div>

      <div className="flex flex-col gap-[0.15em]">
        <span className="uppercase text-gray-400" style={eyebrowStyle}>
          {partyLabel}
        </span>
        <p className="font-semibold text-gray-900">{partyName}</p>
        {partyLocation ? <p className="text-gray-500">{partyLocation}</p> : null}
      </div>
    </div>
  );
}

/**
 * Sign-off block placed after a document's content, with space above it: a
 * confirmation line and dotted "Accepted by" / "Signature" fields.
 */
export function DocumentAcceptanceBlock() {
  return (
    <div
      style={{
        marginTop: 'calc(var(--doc-space-section) * 2.5)',
        fontFamily: 'var(--doc-font-content)',
        fontSize: '0.9em',
      }}
    >
      <p className="italic text-gray-600">Kindly confirm your acceptance or otherwise</p>
      <div className="mt-[2em] flex flex-col gap-[1.6em]">
        {['Accepted by', 'Signature'].map((label) => (
          <div key={label} className="flex items-end gap-(--doc-space-inline)">
            <span className="shrink-0 font-semibold text-gray-800">{label}:</span>
            <span className="w-1/2 border-b border-dotted border-gray-400" />
          </div>
        ))}
      </div>
    </div>
  );
}

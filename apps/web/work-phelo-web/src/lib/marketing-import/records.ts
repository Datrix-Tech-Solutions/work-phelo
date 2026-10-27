import { normalizePhone } from '@/lib/accounting/entityImport';
import type { PipelineStage, ProspectingSetting } from '@/types/marketing';
import {
  byName,
  cellText,
  cellValueText,
  headerIndex,
  loadSheet,
  normalize,
  parseDateText,
  parseNumberText,
  type ImportRecord,
  type Located,
  type Need,
  type ResolveSetting,
  type SettingSlug,
} from './shared';

export interface ImportReferences {
  businessTypes: ProspectingSetting[];
  sourceTypes: ProspectingSetting[];
  products: ProspectingSetting[];
  decisionMakers: ProspectingSetting[];
  /** Prospects only. */
  stages?: PipelineStage[];
  dialCode: string;
  country: string | null;
}

export interface ImportProduct {
  /** As typed in the sheet; the setting is created if it does not exist yet. */
  name: string;
  expectedValue?: number;
  expectedCloseDate?: string;
}

/** What both imports read for a record, before the kind-specific payload is put together. */
export interface ImportBase {
  companyName: string;
  businessType?: string;
  sourceType?: string;
  primaryContact: {
    name: string;
    phone?: string;
    email?: string;
    /** The contact's role, by name. */
    role?: string;
  };
  products: ImportProduct[];
  /** Absent when the sheet gave no location; without coordinates when the map did not find it. */
  location?: { label: string; latitude?: number; longitude?: number };
}

export interface DraftProduct {
  /** The sheet row this product was read from. */
  rowNumber: number;
  name: string;
  value: string;
  closeDate: string;
}

/**
 * A company as read from the sheet, every field still the text that was typed so it can be
 * corrected in the preview. It is checked again after each edit.
 */
export interface Draft {
  rowNumber: number;
  company: string;
  businessType: string;
  sourceType: string;
  /** Prospects only. */
  stage: string;
  contactName: string;
  phone: string;
  email: string;
  role: string;
  location: string;
  products: DraftProduct[];
}

/** What differs between the prospect and client imports. */
export interface ImportKind<P> {
  sheetName: string;
  /** The product is required on every row (prospects) or only when other product columns are filled (clients). */
  productRequired: boolean;
  /** Kind-specific checks on a draft, such as the sales stage. */
  check?: (draft: Draft) => string[];
  build: (base: ImportBase, draft: Draft, resolve: ResolveSetting) => P;
}

const listFor = (refs: ImportReferences, slug: SettingSlug) =>
  slug === 'business-types'
    ? refs.businessTypes
    : slug === 'source-types'
      ? refs.sourceTypes
      : slug === 'products'
        ? refs.products
        : refs.decisionMakers;

/** Reads a sheet of prospects or clients. A company may take several rows, one per product or service. */
export async function readDrafts(file: File, kind: { sheetName: string }): Promise<Draft[]> {
  const sheet = await loadSheet(file, kind.sheetName);
  const columns = headerIndex(sheet);
  for (const required of ['Company Name', 'Contact Name']) {
    if (!columns.has(required)) {
      throw new Error(`Missing column "${required}" — use the template`);
    }
  }

  const drafts = new Map<string, Draft>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cell = (header: string) => cellText(row, columns, header);
    const company = cell('Company Name');
    const product: DraftProduct = {
      rowNumber,
      name: cell('Product or Service'),
      value: cell('Expected Value'),
      closeDate: cellValueText(row, columns, 'Expected Close Date'),
    };
    const contactName = cell('Contact Name');
    const location = cell('Location');
    const hasProduct = product.name || product.value || product.closeDate;
    if (!company && !hasProduct && !contactName && !location) return;

    // The first row of a company supplies its details; later rows only add products.
    const key = normalize(company) || `row-${rowNumber}`;
    const draft = drafts.get(key);
    if (draft) {
      if (hasProduct) draft.products.push(product);
      return;
    }
    drafts.set(key, {
      rowNumber,
      company,
      businessType: cell('Business Type'),
      sourceType: cell('Source Type'),
      stage: cell('Sales Stage'),
      contactName,
      phone: cell('Contact Phone'),
      email: cell('Contact Email'),
      role: cell('Contact Role'),
      location,
      products: hasProduct ? [product] : [],
    });
  });
  return [...drafts.values()];
}

/**
 * Checks a draft. Business types, source types, products and roles that do not exist yet are not
 * errors: they are listed as needs and created when the import runs. `locations` holds the map
 * lookups made so far, keyed by the place as typed; a place not in it is still being looked up.
 */
export function validateDraft<P>(
  draft: Draft,
  kind: ImportKind<P>,
  refs: ImportReferences,
  locations: Map<string, Located | null>,
): ImportRecord<P> {
  const errors: string[] = [];
  const company = draft.company.trim();
  const contactName = draft.contactName.trim();

  if (!company) errors.push('Company name is required');
  else if (company.length > 160) errors.push('Company name is too long (max 160 characters)');
  if (!contactName) errors.push('Contact name is required');

  const phone = normalizePhone(draft.phone, refs.dialCode);
  if (phone === null) errors.push(`Phone "${draft.phone}" is not a valid number`);
  const email = draft.email.trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push(`Email "${email}" is not valid`);
  errors.push(...(kind.check?.(draft) ?? []));

  // The product on each row.
  const products: ImportProduct[] = [];
  const seen = new Set<string>();
  const rows = draft.products.length > 0 || !kind.productRequired ? draft.products : [];
  if (kind.productRequired && rows.length === 0) errors.push('A product or service is required');
  for (const row of rows) {
    const name = row.name.trim();
    const value = parseNumberText(row.value);
    const closeDate = parseDateText(row.closeDate);
    if (!name) errors.push(`Row ${row.rowNumber}: product or service is required`);
    else if (seen.has(normalize(name))) {
      errors.push(`Row ${row.rowNumber}: "${name}" is listed twice for this company`);
    }
    if (value === 'invalid') errors.push(`Row ${row.rowNumber}: expected value is not a number`);
    else if (kind.productRequired && value === null) {
      errors.push(`Row ${row.rowNumber}: expected value is required`);
    }
    if (closeDate === 'invalid') {
      errors.push(`Row ${row.rowNumber}: expected close date must be YYYY-MM-DD`);
    }
    if (name) {
      seen.add(normalize(name));
      products.push({
        name,
        ...(typeof value === 'number' ? { expectedValue: value } : {}),
        ...(closeDate && closeDate !== 'invalid' ? { expectedCloseDate: closeDate } : {}),
      });
    }
  }

  // A location is optional. One the map cannot find is kept as typed, without coordinates.
  const place = draft.location.trim();
  const located = place ? (locations.get(place) ?? null) : null;
  const warnings: string[] = [];
  if (place && !locations.has(place)) errors.push('Looking up the location…');
  else if (place && !located) {
    warnings.push(`"${place}" was not found on the map — it will be saved as typed, without a pin`);
  }

  const businessType = draft.businessType.trim();
  const sourceType = draft.sourceType.trim();
  const role = draft.role.trim();
  const named: Need[] = [
    ...(businessType ? [{ slug: 'business-types' as const, name: businessType }] : []),
    ...(sourceType ? [{ slug: 'source-types' as const, name: sourceType }] : []),
    ...(role ? [{ slug: 'decision-makers' as const, name: role }] : []),
    ...products.map((p) => ({ slug: 'products' as const, name: p.name })),
  ];
  const needs = named.filter((n) => !byName(listFor(refs, n.slug), n.name));

  const base: ImportBase = {
    companyName: company,
    ...(businessType ? { businessType } : {}),
    ...(sourceType ? { sourceType } : {}),
    primaryContact: {
      name: contactName,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(role ? { role } : {}),
    },
    products,
    ...(place
      ? {
          location: located
            ? { label: located.label, latitude: located.latitude, longitude: located.longitude }
            : { label: place },
        }
      : {}),
  };

  return {
    rowNumber: draft.rowNumber,
    name: company,
    contact: contactName,
    items: products.map((p) => p.name).join(', '),
    location: place,
    needs,
    build: errors.length === 0 ? (resolve) => kind.build(base, draft, resolve) : undefined,
    errors,
    warnings,
  };
}

/** The columns both templates share, in the order they appear. */
export const COMMON_HEADERS = [
  'Company Name',
  'Business Type',
  'Source Type',
  'Product or Service',
  'Expected Value',
  'Expected Close Date',
  'Contact Name',
  'Contact Phone',
  'Contact Email',
  'Contact Role',
  'Location',
] as const;

import {
  Facultative,
  FacultativeFormValues,
  FACULTATIVE_FORM_DEFAULTS,
  RiskType,
  RiskTypeField,
} from '@/types/reinsurance';

export type PlacementCustomField = {
  id?: string;
  label: string;
  value: string;
  type?: 'TEXT';
  displayOrder?: number;
};

export const CUSTOM_FIELDS_KEY = 'customFields';

export type PlacementDetailEntry = {
  key: string;
  label: string;
  value: unknown;
};

type SplitPlacementDetailsResult = {
  businessDetails: Record<string, unknown> | undefined;
  offerDetails: Record<string, unknown> | undefined;
};

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function stableCustomFieldId(label: string, displayOrder: number): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `custom-${normalized || displayOrder + 1}`;
}

function toDisplayLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function coerceFieldValue(value: unknown, field: RiskTypeField): unknown {
  if (isBlank(value)) return undefined;

  switch (field.fieldType) {
    case 'NUMBER': {
      const numberValue = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numberValue) ? numberValue : undefined;
    }
    case 'CHECKBOX':
      return value === true || value === 'true' || value === 'on';
    case 'DATE':
    case 'SELECT':
    case 'TEXTAREA':
    case 'TEXT':
    default:
      return String(value);
  }
}

export function normalizeComment(comment: string): string | undefined {
  return comment.trim().length > 0 ? comment : undefined;
}

export function splitPlacementDetails(
  riskDetails: Record<string, unknown>,
  fields: RiskTypeField[],
  extraRiskFields: PlacementCustomField[],
): SplitPlacementDetailsResult {
  const businessDetails: Record<string, unknown> = {};
  const offerDetails: Record<string, unknown> = {};

  for (const field of fields.filter((f) => f.isActive)) {
    const val = coerceFieldValue(riskDetails[field.fieldKey], field);
    if (val === undefined) continue;

    if (field.section === 'BUSINESS_DETAILS') {
      businessDetails[field.fieldKey] = val;
    } else if (field.section === 'OFFER_DETAILS') {
      offerDetails[field.fieldKey] = val;
    }
  }

  const customFields = extraRiskFields
    .map((field, index) => ({
      id: field.id?.trim() || stableCustomFieldId(field.label, index),
      label: field.label.trim(),
      value: field.value.trim(),
      type: field.type ?? 'TEXT',
      displayOrder: field.displayOrder ?? index + 1,
    }))
    .filter((field) => field.label && field.value);

  if (customFields.length > 0) {
    businessDetails[CUSTOM_FIELDS_KEY] = customFields;
  }

  return {
    businessDetails: Object.keys(businessDetails).length ? businessDetails : undefined,
    offerDetails: Object.keys(offerDetails).length ? offerDetails : undefined,
  };
}

export function mergePlacementRiskDetails(
  businessDetails: Record<string, unknown> | null,
  offerDetails: Record<string, unknown> | null,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(businessDetails ?? {})) {
    if (key !== CUSTOM_FIELDS_KEY) merged[key] = value;
  }
  for (const [key, value] of Object.entries(offerDetails ?? {})) {
    if (key !== CUSTOM_FIELDS_KEY) merged[key] = value;
  }

  return merged;
}

export function extractPlacementCustomFields(
  businessDetails: Record<string, unknown> | null,
  offerDetails: Record<string, unknown> | null,
  schemaKeys: Set<string>,
): PlacementCustomField[] {
  const savedCustomFields =
    businessDetails?.[CUSTOM_FIELDS_KEY] ?? offerDetails?.[CUSTOM_FIELDS_KEY];
  if (Array.isArray(savedCustomFields)) {
    const fields: PlacementCustomField[] = [];
    savedCustomFields.forEach((field, index) => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) return;
      const record = field as Record<string, unknown>;
      const label = String(record.label ?? '');
      if (!label) return;

      fields.push({
        id: typeof record.id === 'string' ? record.id : stableCustomFieldId(label, index),
        label,
        value: String(record.value ?? ''),
        type: 'TEXT',
        displayOrder: typeof record.displayOrder === 'number' ? record.displayOrder : index + 1,
      });
    });
    return fields;
  }

  return Object.entries({
    ...(businessDetails ?? {}),
    ...(offerDetails ?? {}),
  })
    .filter(([key]) => key !== CUSTOM_FIELDS_KEY && !schemaKeys.has(key))
    .map(([key, value], index) => ({
      id: stableCustomFieldId(key, index),
      label: key,
      value: String(value ?? ''),
      type: 'TEXT',
      displayOrder: index + 1,
    }));
}

export function placementToFormValues(
  placement: Facultative,
  allRiskTypes: RiskType[],
): FacultativeFormValues {
  const selectedRiskType = allRiskTypes.find((rt) => rt.id === placement.riskTypeId);
  const schemaKeys = new Set(
    (selectedRiskType?.fields ?? []).filter((f) => f.isActive).map((f) => f.fieldKey),
  );

  const extraRiskFields = extractPlacementCustomFields(
    placement.businessDetails,
    placement.offerDetails,
    schemaKeys,
  );

  return {
    ...FACULTATIVE_FORM_DEFAULTS,
    insuranceCompany: placement.cedant.id,
    riskType: placement.riskTypeId ?? '',
    reference: placement.reference,
    policyNumber: placement.policyNumber ?? '',
    title: placement.title,
    sumInsured: placement.sumInsured ?? '',
    rate: placement.rate ?? '',
    premium: placement.premium ?? '',
    facultativeOffer: placement.facultativeOffer ?? '',
    commission: placement.commission ?? '',
    currency: placement.currency ?? '',
    periodFrom: placement.inceptionDate ?? '',
    periodTo: placement.expiryDate ?? '',
    comment: placement.description ?? '',
    riskDetails: mergePlacementRiskDetails(placement.businessDetails, placement.offerDetails),
    extraRiskFields,
  };
}

export function placementDetailEntries(
  details: Record<string, unknown> | null,
): PlacementDetailEntry[] {
  if (!details) return [];

  const entries: PlacementDetailEntry[] = [];

  for (const [key, value] of Object.entries(details)) {
    if (key !== CUSTOM_FIELDS_KEY) {
      entries.push({ key, label: toDisplayLabel(key), value });
      continue;
    }

    if (!Array.isArray(value)) continue;

    value.forEach((field, index) => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) return;
      const record = field as Record<string, unknown>;
      const label = String(record.label ?? '').trim();
      if (!label) return;

      entries.push({
        key:
          typeof record.id === 'string' && record.id.trim()
            ? record.id
            : stableCustomFieldId(label, index),
        label,
        value: record.value ?? '',
      });
    });
  }

  return entries;
}

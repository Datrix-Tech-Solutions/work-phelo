import type { CreateProspectPayload } from '@/types/marketing';
import { byName, downloadTemplate } from './shared';
import { COMMON_HEADERS, type ImportKind, type ImportReferences } from './records';

export const PROSPECT_IMPORT_HEADERS = [
  COMMON_HEADERS[0],
  COMMON_HEADERS[1],
  COMMON_HEADERS[2],
  'Sales Stage',
  ...COMMON_HEADERS.slice(3),
] as const;

/** Stages carry a probability and an order, so unlike the other lists they are never invented. */
const activeStages = (refs: ImportReferences) => (refs.stages ?? []).filter((s) => s.isActive);

export function prospectImportKind(refs: ImportReferences): ImportKind<CreateProspectPayload> {
  const stages = activeStages(refs);
  const firstStage = [...stages].sort((a, b) => a.displayOrder - b.displayOrder)[0];

  return {
    sheetName: 'Prospects',
    productRequired: true,
    check: (draft) => {
      const label = draft.stage.trim();
      if (label && !byName(stages, label)) {
        return [`Unknown sales stage "${label}" — pick one of the existing stages`];
      }
      return stages.length === 0 ? ['There is no sales stage to start the prospect in'] : [];
    },
    build: (base, draft, resolve) => {
      const label = draft.stage.trim();
      // A blank stage starts the prospect at the top of the pipeline.
      const stage = (label ? byName(stages, label) : firstStage)!;
      const business = base.businessType && resolve('business-types', base.businessType);
      const source = base.sourceType && resolve('source-types', base.sourceType);
      const role = base.primaryContact.role && resolve('decision-makers', base.primaryContact.role);

      return {
        companyName: base.companyName,
        ...(business ? { businessTypeId: business } : {}),
        ...(source ? { sourceTypeId: source } : {}),
        pipelineStageId: stage.id,
        primaryContact: {
          name: base.primaryContact.name,
          ...(base.primaryContact.phone ? { phone: base.primaryContact.phone } : {}),
          ...(base.primaryContact.email ? { email: base.primaryContact.email } : {}),
          ...(role ? { decisionMakerTypeId: role } : {}),
        },
        products: base.products.map((p) => ({
          productId: resolve('products', p.name),
          expectedValue: p.expectedValue ?? 0,
          ...(p.expectedCloseDate ? { expectedCloseDate: p.expectedCloseDate } : {}),
        })),
        ...(base.location ? { location: base.location } : {}),
      };
    },
  };
}

export function downloadProspectTemplate(refs: ImportReferences) {
  const stages = (refs.stages ?? []).filter((s) => s.isActive).map((s) => s.name);
  return downloadTemplate({
    filename: 'prospects-import-template.xlsx',
    sheetName: 'Prospects',
    headers: PROSPECT_IMPORT_HEADERS,
    textColumns: ['Contact Phone'],
    example: {
      'Company Name': 'Example Trading Ltd.',
      'Business Type': 'Retail',
      'Source Type': 'Referral',
      'Sales Stage': stages[0] ?? '',
      'Product or Service': 'Fire Insurance',
      'Expected Value': 15000,
      'Expected Close Date': '2026-12-31',
      'Contact Name': 'Jane Doe',
      'Contact Phone': '0241234567',
      'Contact Email': 'jane@example.com',
      'Contact Role': 'Finance Director',
      Location: 'Osu, Accra',
    },
    notes: [
      'One row per product or service. A company with several products takes several rows: the first row supplies its company and contact details, the rest only add products.',
      'Company Name, Product or Service, Expected Value and Contact Name are required.',
      'Business Type, Source Type, Product or Service and Contact Role are created automatically when they do not exist yet. Names are matched ignoring capitalisation and extra spaces.',
      `Sales Stage must be one of the existing stages${stages.length ? `: ${stages.join(', ')}` : ''}. Leave it blank to start the prospect in the first stage.`,
      'Location is optional. It is a place name (for example "Osu, Accra"); it is looked up on the map when you upload the file. If a place cannot be found, use a simpler name.',
      'Expected Close Date is YYYY-MM-DD or DD/MM/YYYY. Phone can be local (0241234567) or include a country code (+233241234567).',
      'Imported prospects are assigned to you.',
    ],
  });
}

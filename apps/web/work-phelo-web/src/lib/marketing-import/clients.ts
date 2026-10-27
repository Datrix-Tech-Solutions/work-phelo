import type { CreateClientPayload } from '@/types/marketing';
import { downloadTemplate } from './shared';
import { COMMON_HEADERS, type ImportKind } from './records';

export const CLIENT_IMPORT_HEADERS = COMMON_HEADERS;

export const clientImportKind: ImportKind<CreateClientPayload> = {
  sheetName: 'Clients',
  // A client can be added with no products yet.
  productRequired: false,
  build: (base, _draft, resolve) => {
    const business = base.businessType && resolve('business-types', base.businessType);
    const source = base.sourceType && resolve('source-types', base.sourceType);
    const role = base.primaryContact.role && resolve('decision-makers', base.primaryContact.role);

    return {
      // Fixed here so retrying a row after a failure reuses the same client.
      id: crypto.randomUUID(),
      companyName: base.companyName,
      ...(business ? { businessTypeId: business } : {}),
      ...(source ? { sourceTypeId: source } : {}),
      primaryContact: {
        name: base.primaryContact.name,
        ...(base.primaryContact.phone ? { phone: base.primaryContact.phone } : {}),
        ...(base.primaryContact.email ? { email: base.primaryContact.email } : {}),
        ...(role ? { decisionMakerTypeId: role } : {}),
      },
      products: base.products.map((p) => ({
        productId: resolve('products', p.name),
        ...(p.expectedValue !== undefined ? { expectedValue: p.expectedValue } : {}),
        ...(p.expectedCloseDate ? { expectedCloseDate: p.expectedCloseDate } : {}),
      })),
      ...(base.location ? { location: base.location } : {}),
    };
  },
};

export function downloadClientTemplate() {
  return downloadTemplate({
    filename: 'clients-import-template.xlsx',
    sheetName: 'Clients',
    headers: CLIENT_IMPORT_HEADERS,
    textColumns: ['Contact Phone'],
    example: {
      'Company Name': 'Example Trading Ltd.',
      'Business Type': 'Retail',
      'Source Type': 'Referral',
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
      'One row per product or service. A client with several products takes several rows: the first row supplies its company and contact details, the rest only add products.',
      'Company Name and Contact Name are required. Products are optional.',
      'Business Type, Source Type, Product or Service and Contact Role are created automatically when they do not exist yet. Names are matched ignoring capitalisation and extra spaces.',
      'Location is optional. It is a place name (for example "Osu, Accra"); it is looked up on the map when you upload the file. If a place cannot be found, use a simpler name.',
      'Expected Close Date is YYYY-MM-DD or DD/MM/YYYY. Phone can be local (0241234567) or include a country code (+233241234567).',
      'Imported clients are assigned to you and have no billing yet.',
    ],
  });
}

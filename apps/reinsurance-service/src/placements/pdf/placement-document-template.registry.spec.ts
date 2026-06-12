import { BadRequestException } from '@nestjs/common';
import { PlacementDocumentType } from '../../../prisma/generated/client';
import { PlacementDocumentTemplateRegistry } from './placement-document-template.registry';

describe('PlacementDocumentTemplateRegistry', () => {
  const registry = new PlacementDocumentTemplateRegistry();

  it('resolves CLOSING_SLIP templates', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.CLOSING_SLIP,
      {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: {
          closingNumber: 'CLO-001',
          currency: 'GHS',
          signedLinePercent: '40',
          participant: {
            counterparty: { name: 'Avenue Re' },
          },
        },
      },
      {
        documentNumber: 'DOC-CS-001',
        title: 'Closing Slip CLO-001',
        generatedAt: '2026-06-12T00:00:00.000Z',
      },
    );

    expect(html).toContain('Closing Slip');
    expect(html).toContain('DOC-CS-001');
    expect(html).toContain('CLO-001');
    expect(html).toContain('Avenue Re');
  });

  it('rejects unsupported document types', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.OFFER_SLIP,
        { documentType: PlacementDocumentType.OFFER_SLIP },
        {
          documentNumber: 'DOC-OS-001',
          title: 'Offer Slip',
          generatedAt: null,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid CLOSING_SLIP render payloads', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.CLOSING_SLIP,
        { documentType: PlacementDocumentType.CLOSING_SLIP },
        {
          documentNumber: 'DOC-CS-001',
          title: 'Closing Slip',
          generatedAt: null,
        },
      ),
    ).toThrow(BadRequestException);
  });
});

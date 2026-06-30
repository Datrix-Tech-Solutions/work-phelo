import { BadRequestException } from '@nestjs/common';
import { PlacementDocumentType } from '../../../prisma/generated/client';
import { PlacementDocumentTemplateRegistry } from './placement-document-template.registry';

describe('PlacementDocumentTemplateRegistry', () => {
  const registry = new PlacementDocumentTemplateRegistry();
  const offerSlipPayload = {
    documentType: PlacementDocumentType.OFFER_SLIP,
    placement: {
      reference: 'FAC-001',
      policyNumber: 'POL-001',
      classOfBusiness: 'Engineering',
      currency: 'GHS',
      inceptionDate: '2026-01-01',
      expiryDate: '2026-12-31',
      sumInsured: 1000000,
      premium: 50000,
      commission: 10,
      facultativeOffer: 60,
    },
    cedant: { name: 'Acme Insurance' },
    businessEntries: [
      {
        key: 'originalInsured',
        label: 'Original Insured',
        value: 'Acme Plant',
      },
    ],
    offerEntries: [
      { key: 'policyNumber', label: 'Policy Number', value: 'POL-001' },
    ],
    participantPreview: {
      participant: {
        id: 'participant-1',
        sharePercent: 40,
        brokerageFee: 7.5,
        counterparty: { name: 'Avenue Re' },
      },
      slipFinancials: {
        facOffer: 60,
        facSumInsured: 600000,
      },
      distributionFinancials: {
        premiumShare: 12000,
        brokerageFee: 7.5,
        brokerageAmount: 900,
      },
    },
    offerContext: {
      participantId: 'participant-1',
      reinsurerName: 'Avenue Re',
      offeredLinePercent: 40,
    },
    branding: {
      productName: 'WorkPhelo',
      documentFamily: 'Reinsurance Operations',
    },
  };

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

  it('resolves OFFER_SLIP templates', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.OFFER_SLIP,
      offerSlipPayload,
      {
        documentNumber: 'DOC-OS-001',
        title: 'Offer Slip FAC-001 - Avenue Re',
        generatedAt: '2026-06-12T00:00:00.000Z',
      },
    );

    expect(html).toContain('Offer Slip');
    expect(html).toContain('DOC-OS-001');
    expect(html).toContain('Avenue Re');
    expect(html).toContain('POL-001');
    expect(html).toContain('100% Sum Insured');
    expect(html).toContain('Net Premium');
  });

  it('rejects unsupported document types', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.DEBIT_NOTE,
        { documentType: PlacementDocumentType.DEBIT_NOTE },
        {
          documentNumber: 'DOC-DN-001',
          title: 'Debit Note',
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

  it('rejects invalid OFFER_SLIP render payloads', () => {
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
});

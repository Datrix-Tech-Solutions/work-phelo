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
      productName: 'iRisk Reinsurance Brokers',
      documentFamily: 'Reinsurance Operations',
      logoDataUrl: 'data:image/png;base64,dGVuYW50LWxvZ28=',
      watermarkDataUrl: 'data:image/png;base64,dGVuYW50LWxvZ28=',
      documentHeaderColor: '#173f5f',
    },
  };
  const notePayload = (type: PlacementDocumentType) => ({
    documentType: type,
    note: {
      type,
      noteNumber:
        type === PlacementDocumentType.DEBIT_NOTE
          ? 'DN-001'
          : type === PlacementDocumentType.CREDIT_NOTE
            ? 'CN-001'
            : type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
              ? 'EDN-001'
              : 'ECN-001',
      status: 'ISSUED',
      direction:
        type === PlacementDocumentType.DEBIT_NOTE ||
        type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
          ? 'CEDANT_TO_BROKER'
          : 'BROKER_TO_REINSURER',
      noteDate: '2026-06-12T00:00:00.000Z',
      currency: 'GHS',
      grossAmount: '5000',
      commissionPercent: '10',
      commissionAmount: '500',
      brokeragePercent: '5',
      brokerageAmount: '250',
      nicLevyPercent: '1',
      nicLevyAmount: '50',
      withholdingTaxPercent: '2',
      withholdingTaxAmount: '100',
      netAmount: '4100',
      placement: {
        reference: 'FAC-001',
        title: 'Engineering Risk',
      },
      counterparty: {
        name:
          type === PlacementDocumentType.DEBIT_NOTE ||
          type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
            ? 'Acme Insurance'
            : 'Avenue Re',
        registrationNumber: 'REG-001',
        email: 'finance@example.com',
        country: 'GH',
      },
      closing: { closingNumber: 'CLO-001' },
      endorsement: { endorsementNumber: 'END-001' },
      endorsementClosing: { closingNumber: 'END-CLO-001' },
    },
    branding: {
      productName: 'WorkPhelo',
      documentFamily: 'Reinsurance Operations',
    },
  });
  const endorsementSlipPayload = {
    documentType: PlacementDocumentType.ENDORSEMENT_SLIP,
    endorsement: {
      endorsementNumber: 'END-001',
      type: 'ADDITION',
      impactType: 'CAPACITY_INCREASE',
      status: 'CLOSED',
      effectiveDate: '2026-06-12T00:00:00.000Z',
      originalSnapshot: {
        placement: {
          title: 'Engineering Risk',
          premium: '1000',
          currency: 'GHS',
          facultativeOffer: '40',
        },
      },
      proposedSnapshot: {
        placement: {
          title: 'Engineering Risk',
          premium: '1200',
          currency: 'GHS',
          facultativeOffer: '45',
        },
      },
      placement: {
        reference: 'FAC-001',
        title: 'Engineering Risk',
        currency: 'GHS',
        cedant: { name: 'Acme Insurance' },
      },
      participants: [
        {
          status: 'CLOSED',
          sharePercent: '10',
          signedLinePercent: '10',
          counterparty: { name: 'Avenue Re' },
        },
      ],
      closings: [
        {
          closingNumber: 'ENC-001',
          status: 'CONFIRMED',
          signedLinePercent: '10',
          premiumSnapshot: '1200',
          netPremium: '1020',
          currency: 'GHS',
          endorsementParticipant: {
            counterparty: { name: 'Avenue Re' },
          },
        },
      ],
      notes: [
        {
          noteNumber: 'ECN-001',
          type: 'ENDORSEMENT_CREDIT_NOTE',
          status: 'ISSUED',
          netAmount: '1020',
          currency: 'GHS',
        },
      ],
    },
    branding: {
      productName: 'WorkPhelo',
      authorizedSignatoryName: 'Ama Broker',
      authorizedSignatoryTitle: 'Principal Officer',
    },
  };
  const endorsementCertificatePayload = {
    documentType: PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
    endorsementCertificate: {
      closingNumber: 'ENC-001',
      status: 'CONFIRMED',
      signedLinePercent: '10',
      sharePercent: '10',
      premiumSnapshot: '1200',
      commissionPercent: '10',
      commissionAmount: '120',
      brokeragePercent: '5',
      brokerageAmount: '60',
      netPremium: '1020',
      currency: 'GHS',
      placement: {
        reference: 'FAC-001',
        title: 'Engineering Risk',
        currency: 'GHS',
        cedant: { name: 'Acme Insurance' },
      },
      endorsement: {
        endorsementNumber: 'END-001',
        type: 'ADDITION',
        impactType: 'CAPACITY_INCREASE',
        effectiveDate: '2026-06-12T00:00:00.000Z',
        originalSnapshot: {
          placement: { premium: '1000', currency: 'GHS' },
        },
        proposedSnapshot: {
          placement: { premium: '1200', currency: 'GHS' },
        },
      },
      endorsementParticipant: {
        counterparty: { name: 'Avenue Re' },
        originalParticipant: { signedLinePercent: '5' },
      },
      notes: [
        {
          noteNumber: 'ECN-001',
          type: 'ENDORSEMENT_CREDIT_NOTE',
          status: 'ISSUED',
          netAmount: '1020',
          currency: 'GHS',
        },
      ],
    },
    branding: {
      productName: 'WorkPhelo',
      authorizedSignatoryName: 'Ama Broker',
      authorizedSignatoryTitle: 'Principal Officer',
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
        qrCodeDataUrl: 'data:image/png;base64,qr',
      },
    );

    expect(html).toContain('Closing Slip');
    expect(html).toContain('DOC-CS-001');
    expect(html).toContain('CLO-001');
    expect(html).toContain('Avenue Re');
    expect(html).toContain('The Managing Director');
    expect(html).toContain('broker-watermark');
    expect(html).toContain('Document verification');
  });

  it('resolves OFFER_SLIP templates', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.OFFER_SLIP,
      offerSlipPayload,
      {
        documentNumber: 'DOC-OS-001',
        title: 'Offer Slip FAC-001 - Avenue Re',
        generatedAt: '2026-06-12T00:00:00.000Z',
        qrCodeDataUrl: 'data:image/png;base64,qr',
      },
    );

    expect(html).toContain('Offer Slip');
    expect(html).toContain('DOC-OS-001');
    expect(html).toContain('Avenue Re');
    expect(html).toContain('POL-001');
    expect(html).toContain('100% Sum Insured');
    expect(html).toContain('Net Premium');
    expect(html).toContain('broker-watermark');
    expect(html).toContain('Document verification');
    expect(html).toContain('Acceptance');
    expect(html).toContain('iRisk Reinsurance Brokers logo');
    expect(html).toContain('broker-watermark-image');
  });

  it.each([
    [PlacementDocumentType.DEBIT_NOTE, 'Debit Note', 'Acme Insurance'],
    [PlacementDocumentType.CREDIT_NOTE, 'Credit Note', 'Avenue Re'],
    [
      PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE,
      'Endorsement Debit Note',
      'Acme Insurance',
    ],
    [
      PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      'Endorsement Credit Note',
      'Avenue Re',
    ],
  ])('resolves %s templates', (type, title, counterparty) => {
    const html = registry.renderHtml(type, notePayload(type), {
      documentNumber: 'DOC-NOTE-001',
      title,
      generatedAt: '2026-06-12T00:00:00.000Z',
    });

    expect(html).toContain(title);
    expect(html).toContain('DOC-NOTE-001');
    expect(html).toContain(counterparty);
    expect(html).toContain('Gross Amount');
    expect(html).toContain('Commission');
    expect(html).toContain('Brokerage');
    expect(html).toContain('NIC Levy');
    expect(html).toContain('Withholding Tax');
    expect(html).toContain('Net Amount');
    expect(html).toContain('Authorized signature / stamp');
    expect(html).toContain('broker-watermark');
    expect(html).toContain('Document verification');
    if (
      type === PlacementDocumentType.DEBIT_NOTE ||
      type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
    ) {
      expect(html).toContain('Payment Instructions and Premium Warranty');
      expect(html).toContain('Bank account');
    }
  });

  it('resolves ENDORSEMENT_SLIP templates', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.ENDORSEMENT_SLIP,
      endorsementSlipPayload,
      {
        documentNumber: 'DOC-ES-001',
        title: 'Endorsement Slip',
        generatedAt: null,
      },
    );

    expect(html).toContain('Endorsement Slip');
    expect(html).toContain('END-001');
    expect(html).toContain('Original and Revised Terms');
    expect(html).toContain('Confirmed Endorsement Closings');
    expect(html).toContain('Ama Broker');
  });

  it('resolves ENDORSEMENT_CERTIFICATE templates', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
      endorsementCertificatePayload,
      {
        documentNumber: 'DOC-ECF-001',
        title: 'Endorsement Certificate',
        generatedAt: null,
      },
    );

    expect(html).toContain('Endorsement Certificate');
    expect(html).toContain('ENC-001');
    expect(html).toContain('Avenue Re');
    expect(html).toContain('Confirmed Reinsurer Participation');
    expect(html).toContain('Ama Broker');
  });

  it('rejects unsupported document types', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.CLAIM_NOTICE,
        { documentType: PlacementDocumentType.CLAIM_NOTICE },
        {
          documentNumber: 'DOC-CLM-001',
          title: 'Claim Notice',
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

  it('rejects malformed note render payloads', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.DEBIT_NOTE,
        {
          documentType: PlacementDocumentType.DEBIT_NOTE,
          note: {
            type: PlacementDocumentType.DEBIT_NOTE,
            noteNumber: 'DN-001',
            currency: 'GHS',
          },
        },
        {
          documentNumber: 'DOC-DN-001',
          title: 'Debit Note',
          generatedAt: null,
        },
      ),
    ).toThrow('DEBIT_NOTE renderPayload is missing valid immutable note data');
  });
});

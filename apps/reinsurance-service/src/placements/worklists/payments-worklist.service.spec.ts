import { PlacementStatus } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsurancePaymentsWorklistService } from './payments-worklist.service';

describe('ReinsurancePaymentsWorklistService', () => {
  let prisma: { $queryRaw: jest.Mock };
  let service: ReinsurancePaymentsWorklistService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
    };
    service = new ReinsurancePaymentsWorklistService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns paginated row-ready payment data from one bounded bulk query', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'placement-1',
        placementId: 'placement-1',
        reference: 'FAC-001',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        classOfBusiness: 'Marine',
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        sumInsured: '1000000.00',
        facultativeOffer: '80.0000',
        commission: '10.0000',
        acceptedParticipantCount: 2n,
        currency: 'GHS',
        paidAmount: '60000.00',
        outstandingAmount: '40000.00',
        currentObligation: '100000.00',
        latestConfirmedPaymentDate: new Date('2026-08-20T12:00:00.000Z'),
        placementStatus: PlacementStatus.CLOSING,
        paymentStatus: 'Part Payment',
        sortDate: new Date('2026-08-20T12:00:00.000Z'),
        totalCount: 150n,
      },
    ]);

    const result = await service.findPayments('tenant-1', {
      page: 2,
      limit: 25,
      search: 'xpress',
      status: 'Part Payment',
      cedantId: 'cedant-1',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({
      page: 2,
      limit: 25,
      total: 150,
      totalPages: 6,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'placement-1',
        placementId: 'placement-1',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        cedantName: 'Acme Insurance',
        sumInsured: 1000000,
        facultativeOffer: 80,
        commission: 10,
        facultativeSumInsured: 800000,
        acceptedParticipantCount: 2,
        paidAmount: 60000,
        outstandingAmount: 40000,
        outstandingLabel: 'outstanding',
        currentObligation: 100000,
        latestConfirmedPaymentDate: '2026-08-20T12:00:00.000Z',
        placementStatus: PlacementStatus.CLOSING,
        paymentStatus: 'Part Payment',
        sortDate: '2026-08-20T12:00:00.000Z',
      }),
    ]);
  });

  it('returns an empty page without consulting Accounting or per-placement services', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await service.findPayments('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('labels credit balances using signed outstanding values', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'placement-1',
        placementId: 'placement-1',
        reference: 'FAC-001',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        classOfBusiness: null,
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        sumInsured: null,
        facultativeOffer: null,
        commission: null,
        acceptedParticipantCount: 0,
        currency: 'GHS',
        paidAmount: '120000.00',
        outstandingAmount: '-20000.00',
        currentObligation: '100000.00',
        latestConfirmedPaymentDate: null,
        placementStatus: PlacementStatus.CLOSED,
        paymentStatus: 'Paid',
        sortDate: '2026-08-20T12:00:00.000Z',
        totalCount: 1,
      },
    ]);

    const result = await service.findPayments('tenant-1', {
      page: 1,
      limit: 10,
      status: 'Paid',
    });

    expect(result.items[0]).toMatchObject({
      outstandingAmount: -20000,
      outstandingLabel: 'credit',
      paymentStatus: 'Paid',
    });
  });
});

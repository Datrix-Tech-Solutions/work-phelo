import { useQuery } from '@tanstack/react-query';
import { Facultative } from '@/types/reinsurance';

const FACULTATIVES_KEY = ['reinsurance', 'facultatives'] as const;

// TODO: replace mock with real API call once endpoint is ready
const MOCK_FACULTATIVES: Facultative[] = [
  {
    id: '1',
    policyNumber: 'FAC-2025-001',
    insuranceCompany: 'Enterprise Insurance Co.',
    insured: 'Accra Breweries Ltd',
    riskType: 'Property All Risk',
    sumInsured: 5000000,
    rate: 1.5,
    commission: 15,
    facultativeOffer: 60,
    preliminaryBrokerage: 5,
    premium: 75000,
    currency: 'USD',
    periodFrom: '2025-01-01',
    periodTo: '2025-12-31',
    year: 2025,
    offerDate: '2025-01-15',
    status: 'Open',
  },
];

export function useFacultatives() {
  return useQuery({
    queryKey: FACULTATIVES_KEY,
    queryFn: async (): Promise<Facultative[]> => MOCK_FACULTATIVES,
  });
}

export function useFacultativePlacement(id: string) {
  return useQuery({
    queryKey: [...FACULTATIVES_KEY, id],
    queryFn: async (): Promise<Facultative | undefined> =>
      MOCK_FACULTATIVES.find((f) => f.id === id),
  });
}

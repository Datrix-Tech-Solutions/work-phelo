import { useRef } from 'react';
import { usePipelineStages } from '@/hooks/marketing/usePipelineStages';
import {
  useCreateProspectingSetting,
  useProspectingSettings,
} from '@/hooks/marketing/useProspectingSettings';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import type { ImportReferences } from '@/lib/marketing-import/records';
import { byName, normalize, type Need, type ResolveSetting } from '@/lib/marketing-import/shared';

/** The CRM lists an import matches the sheet against, and whether they have all loaded. */
export function useImportReferences(withStages: boolean) {
  const { dialCode, country } = useTenantConfig();
  const businessTypes = useProspectingSettings('business-types');
  const sourceTypes = useProspectingSettings('source-types');
  const products = useProspectingSettings('products');
  const decisionMakers = useProspectingSettings('decision-makers');
  const stages = usePipelineStages();

  const createBusinessType = useCreateProspectingSetting('business-types');
  const createSourceType = useCreateProspectingSetting('source-types');
  const createProduct = useCreateProspectingSetting('products');
  const createDecisionMaker = useCreateProspectingSetting('decision-makers');

  const ready =
    !businessTypes.isLoading &&
    !sourceTypes.isLoading &&
    !products.isLoading &&
    !decisionMakers.isLoading &&
    (!withStages || !stages.isLoading);

  const refs: ImportReferences = {
    businessTypes: businessTypes.data ?? [],
    sourceTypes: sourceTypes.data ?? [],
    products: products.data ?? [],
    decisionMakers: decisionMakers.data ?? [],
    ...(withStages ? { stages: stages.data ?? [] } : {}),
    dialCode,
    country,
  };

  // Settings created during this import, so a name used by many rows (or a retry) is made once.
  const created = useRef(new Map<string, string>());

  const lists = {
    'business-types': { items: refs.businessTypes, create: createBusinessType.mutateAsync },
    'source-types': { items: refs.sourceTypes, create: createSourceType.mutateAsync },
    products: { items: refs.products, create: createProduct.mutateAsync },
    'decision-makers': { items: refs.decisionMakers, create: createDecisionMaker.mutateAsync },
  } as const;

  /** Creates whatever the records name that is missing, and returns a lookup for building payloads. */
  async function prepare(needs: Need[]): Promise<ResolveSetting> {
    for (const need of needs) {
      const id = `${need.slug}:${normalize(need.name)}`;
      const list = lists[need.slug];
      if (created.current.has(id) || byName(list.items, need.name)) continue;
      const setting = await list.create({ name: need.name.trim() });
      created.current.set(id, setting.id);
    }
    return (slug, name) => {
      const existing = byName(lists[slug].items, name);
      const id = existing?.id ?? created.current.get(`${slug}:${normalize(name)}`);
      if (!id) throw new Error(`"${name}" could not be set up`);
      return id;
    };
  }

  return { refs, ready, prepare };
}

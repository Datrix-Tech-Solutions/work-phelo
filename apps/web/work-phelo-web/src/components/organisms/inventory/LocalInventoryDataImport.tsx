'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/hooks/inventory/inventoryApi';

/**
 * Before these lived in the inventory service, customers, suppliers, subcategories, item
 * subcategories and variants, and custom adjustment reasons were kept in this browser. This moves
 * whatever a browser still holds into the service once, then clears it. Movement variant tags are
 * not moved: variant stock starts from the movements recorded after this.
 */
const KEYS = {
  parties: 'inventory-parties',
  subcategories: 'inventory-subcategories',
  itemExtras: 'inventory-item-extras',
  reasons: 'inventory-adjustment-reasons',
  movementVariants: 'inventory-movement-variants',
};

const read = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ((JSON.parse(raw) as { state?: T }).state ?? null) : null;
  } catch {
    return null;
  }
};

/** Runs a request and carries on if it fails: a duplicate or a vanished record isn't worth stopping for. */
const attempt = async (request: () => Promise<unknown>) => {
  try {
    await request();
  } catch {
    // Skipped.
  }
};

interface Party {
  kind: 'CUSTOMER' | 'SUPPLIER';
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}
interface Named {
  id: string;
  name: string;
}

async function importLocalData() {
  const parties = read<{ parties: Party[] }>(KEYS.parties)?.parties ?? [];
  const subcategories = read<{ byCategory: Record<string, string[]> }>(KEYS.subcategories);
  const extras = read<{ byItem: Record<string, { subcategory: string; variants: string[] }> }>(
    KEYS.itemExtras,
  );
  const reasons = read<{ custom: string[] }>(KEYS.reasons)?.custom ?? [];
  const anything =
    parties.length ||
    Object.keys(subcategories?.byCategory ?? {}).length ||
    Object.keys(extras?.byItem ?? {}).length ||
    reasons.length;
  if (anything) {
    // If the service can't be reached, stop and leave the local data for the next visit.
    const [existingParties, existingSubs, existingVariants, items] = await Promise.all([
      inventoryApi.get<(Named & { kind: string })[]>('/parties'),
      inventoryApi.get<(Named & { categoryId: string })[]>('/subcategories'),
      inventoryApi.get<(Named & { itemId: string })[]>('/variants'),
      inventoryApi.get<{ id: string; categoryId: string; subcategoryId: string | null }[]>(
        '/items',
      ),
    ]);

    for (const p of parties) {
      if (existingParties.some((e) => e.kind === p.kind && e.name === p.name)) continue;
      await attempt(() => inventoryApi.post('/parties', p));
    }

    const subs = [...existingSubs];
    const ensureSubcategory = async (categoryId: string, name: string) => {
      const found = subs.find((s) => s.categoryId === categoryId && s.name === name);
      if (found) return found.id;
      try {
        const created = await inventoryApi.post<Named>('/subcategories', { categoryId, name });
        subs.push({ ...created, categoryId });
        return created.id;
      } catch {
        return null;
      }
    };
    for (const [categoryId, names] of Object.entries(subcategories?.byCategory ?? {})) {
      for (const name of names) await ensureSubcategory(categoryId, name);
    }

    for (const [itemId, extra] of Object.entries(extras?.byItem ?? {})) {
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      for (const name of extra.variants) {
        if (existingVariants.some((v) => v.itemId === itemId && v.name === name)) continue;
        await attempt(() => inventoryApi.post('/variants', { itemId, name }));
      }
      if (extra.subcategory && !item.subcategoryId) {
        const subcategoryId = await ensureSubcategory(item.categoryId, extra.subcategory);
        if (subcategoryId) {
          await attempt(() => inventoryApi.patch(`/items/${itemId}`, { subcategoryId }));
        }
      }
    }

    for (const name of reasons)
      await attempt(() => inventoryApi.post('/adjustment-reasons', { name }));
  }
  Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
}

/** Mount once inside the inventory pages; does nothing when the browser holds no old data. */
export function LocalInventoryDataImport() {
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    importLocalData()
      .then(() => queryClient.invalidateQueries({ queryKey: ['inventory'] }))
      .catch(() => {
        // The service wasn't reachable; the data stays here and is tried again next visit.
      });
  }, [queryClient]);

  return null;
}

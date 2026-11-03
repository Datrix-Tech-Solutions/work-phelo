import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ItemImageStore {
  /** Item image by item id. */
  images: Record<string, string | null>;
  setImage: (itemId: string, imageUrl: string | null) => void;
}

/**
 * Item images aren't stored by the inventory service yet, so they are kept in this browser only,
 * keyed by item id: not shared across devices or users. Remove once the service stores them.
 */
export const useItemImageStore = create<ItemImageStore>()(
  persist(
    (set) => ({
      images: {},
      setImage: (itemId, imageUrl) => set((s) => ({ images: { ...s.images, [itemId]: imageUrl } })),
    }),
    { name: 'inventory-item-images' },
  ),
);

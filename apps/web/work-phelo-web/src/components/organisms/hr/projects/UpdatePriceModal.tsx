'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { formatMoney } from '@/lib/projectPricing';

interface Props {
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (price: number) => void;
}

/** Changes the price of a flat-rate client project, which is otherwise fixed once it is created. */
export function UpdatePriceModal({ currentPrice, isOpen, onClose, onSave }: Props) {
  const [price, setPrice] = useState(currentPrice);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (price <= 0) return setError('Enter a price above zero');
    if (price === currentPrice) return setError('This is already the price');
    onSave(price);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Price"
      description={`The price is now ${formatMoney(currentPrice)}. It applies to what is billed from here on.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Update Price</Button>
        </>
      }
    >
      <div className="mt-4">
        <NumberField
          label="New Price (GHS)"
          value={price}
          onChange={(n) => {
            setPrice(n);
            setError('');
          }}
          className="w-full py-2"
          error={error}
        />
      </div>
    </Modal>
  );
}

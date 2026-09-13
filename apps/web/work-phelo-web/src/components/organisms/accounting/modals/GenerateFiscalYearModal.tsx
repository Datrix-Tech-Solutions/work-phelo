'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { YearSelect } from '@/components/atoms/YearSelect';

interface GenerateFiscalYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (year: number) => void;
}

export function GenerateFiscalYearModal({
  isOpen,
  onClose,
  onGenerate,
}: GenerateFiscalYearModalProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Fiscal Year"
      description="Pick a year. Twelve monthly periods (January–December) are created, each running from the first to the last day of the month."
      width="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onGenerate(year)}>Generate</Button>
        </>
      }
    >
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Year</label>
        <YearSelect
          value={year}
          onChange={setYear}
          minYear={currentYear - 5}
          maxYear={currentYear + 5}
        />
      </div>
    </Modal>
  );
}

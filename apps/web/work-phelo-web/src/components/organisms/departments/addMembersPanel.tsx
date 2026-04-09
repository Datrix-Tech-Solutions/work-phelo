'use client';

import { useState, useMemo } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { MemberRow } from '@/components/molecules/departments/MemberRow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  department: any;
  employees: any[];
  onAddMembers: (departmentId: string, employeeIds: string[]) => Promise<void>;
}

export function AddMembersPanel({ isOpen, onClose, department, employees, onAddMembers }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');

  const filteredEmployees = useMemo(() => {
    const q = memberSearch.toLowerCase();
    return employees.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return !q || name.includes(q) || e.jobTitle?.toLowerCase().includes(q);
    });
  }, [employees, memberSearch]);

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddMembers = async () => {
    if (selectedIds.size === 0 || !department) return;
    await onAddMembers(department.id, Array.from(selectedIds));
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add Members"
      description={`Select employees to add to "${department?.name}"`}
      width="w-[460px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500">
            {selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={selectedIds.size === 0} onClick={handleAddMembers}>
              Add Members
            </Button>
          </div>
        </div>
      }
    >
      {/* Search Input */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Search employees..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-input text-sm"
        />
      </div>

      {/* Employee List */}
      <div className="flex flex-col divide-y divide-gray-100 -mx-6 px-6 max-h-[420px] overflow-y-auto">
        {filteredEmployees.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No employees found</p>
        ) : (
          filteredEmployees.map((emp) => (
            <MemberRow
              key={emp.id}
              employee={emp}
              checked={selectedIds.has(emp.id)}
              alreadyInDept={emp.departmentId === department?.id}
              onToggle={toggleEmployee}
            />
          ))
        )}
      </div>
    </SidePanel>
  );
}

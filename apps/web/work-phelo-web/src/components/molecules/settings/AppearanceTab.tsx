'use client';

import { useState } from 'react';
import { ModuleThemeRow } from '@/components/molecules/settings/ModuleThemeRow';

const MODULES = [
  { key: 'hr', name: 'Human Resource', defaultColor: '#0D2244' },
  { key: 'marketing', name: 'Marketing', defaultColor: '#16A34A' },
  { key: 'accounting', name: 'Accounting', defaultColor: '#DC2626' },
  { key: 'operations', name: 'Operations', defaultColor: '#4906D9' },
  { key: 'recruitment', name: 'Recruitment', defaultColor: '#0284C7' },
] as const;

type ModuleKey = (typeof MODULES)[number]['key'];

export function AppearanceTab() {
  const [moduleColors, setModuleColors] = useState<Record<ModuleKey, string>>(
    Object.fromEntries(MODULES.map((m) => [m.key, m.defaultColor])) as Record<ModuleKey, string>,
  );

  return (
    <div className="py-6 flex flex-col gap-8 max-w-lg">
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Module Themes</h3>
          <p className="text-sm text-gray-400 mt-0.5">Choose an accent color for each module.</p>
        </div>

        <div className="flex flex-col">
          {MODULES.map((mod) => (
            <ModuleThemeRow
              key={mod.key}
              moduleKey={mod.key}
              name={mod.name}
              color={moduleColors[mod.key]}
              onColorChange={(color) => setModuleColors((prev) => ({ ...prev, [mod.key]: color }))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

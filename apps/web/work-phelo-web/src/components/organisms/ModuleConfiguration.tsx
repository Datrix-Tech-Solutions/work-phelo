'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/SidePanel';

export interface ModuleOption {
  key: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

export interface Module {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  icon?: React.ReactNode;
  options?: ModuleOption[];
}

interface ModuleConfigurationProps {
  modules: Module[];
  onToggle: (moduleId: string, enabled: boolean) => void;
  onSave: (modules: Module[]) => void;
  isSaving?: boolean;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!enabled);
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        enabled ? 'bg-[#0D2244]' : 'bg-gray-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
          enabled ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

const DefaultModuleIcon = () => (
  <div className="w-10 h-10 rounded-input bg-[#0D2244] flex items-center justify-center shrink-0">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  </div>
);

export function ModuleConfiguration({
  modules: initialModules,
  onToggle,
  onSave,
  isSaving,
}: ModuleConfigurationProps) {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  const handleToggle = (id: string, enabled: boolean) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, enabled } : m)));
    onToggle(id, enabled);
  };

  const handleRowClick = (mod: Module) => {
    if (mod.options && mod.options.length > 0) {
      setActiveModule(mod);
    }
  };

  return (
    <>
      <div className="border border-gray-200 rounded-card flex flex-col h-full overflow-hidden">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Module Configuration</h3>
          <p className="text-sm text-gray-400 mt-1">
            Enable or disable modules available to this company.
          </p>
        </div>

        {/* Scrollable module list */}
        <div className="flex-1 overflow-y-auto px-6 flex flex-col divide-y divide-gray-100 min-h-0">
          {modules.map((mod) => (
            <div
              key={mod.id}
              onClick={() => handleRowClick(mod)}
              className={cn(
                'flex items-center gap-4 py-4',
                mod.options &&
                  mod.options.length > 0 &&
                  'cursor-pointer hover:bg-gray-50 -mx-6 px-6 transition-colors',
              )}
            >
              {mod.icon ?? <DefaultModuleIcon />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{mod.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{mod.description}</p>
              </div>
              <Toggle enabled={mod.enabled} onChange={(v) => handleToggle(mod.id, v)} />
            </div>
          ))}
        </div>

        {/* save button */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end">
          <button
            onClick={() => onSave(modules)}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-input hover:bg-gray-200 transition-colors disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Module options side panel */}
      {activeModule && (
        <SidePanel
          isOpen={!!activeModule}
          onClose={() => setActiveModule(null)}
          title={activeModule.name}
          description={activeModule.description}
        >
          <div className="flex flex-col divide-y divide-gray-100">
            {activeModule.options?.map((opt) => (
              <div key={opt.key} className="flex items-center gap-4 py-4">
                {opt.icon ?? <DefaultModuleIcon />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                </div>
                <Toggle enabled={false} onChange={() => {}} />
              </div>
            ))}
          </div>
        </SidePanel>
      )}
    </>
  );
}

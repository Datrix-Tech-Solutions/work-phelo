'use client';

import { useState } from 'react';
import { Icons, MODULE_COLORS, ModuleIcons, type ModuleKey } from '@/components/atoms/icons';
import { cardClass, cn } from '@/lib/utils';
import { TenantSmsSenderIds } from './TenantSmsSenderIds';
import { TenantSmsWallet } from './TenantSmsWallet';
import { TenantProjectsLabel } from './TenantProjectsLabel';

interface TenantModuleConfigurationTabProps {
  tenantId: string;
  marketingEnabled: boolean;
  /** HR is on and its Projects feature is switched on. */
  projectsEnabled: boolean;
  /** The name saved for Projects; empty when none was set. */
  projectsLabel: string;
}

interface ConfigOption {
  key: string;
  label: string;
  description: string;
}

interface ConfigModule {
  key: ModuleKey;
  label: string;
  description: string;
  options: ConfigOption[];
}

const ROOT_LABEL = 'Module Configuration';

function configurableModules(marketingEnabled: boolean, projectsEnabled: boolean): ConfigModule[] {
  const modules: ConfigModule[] = [];
  if (projectsEnabled) {
    modules.push({
      key: 'hr',
      label: 'Human Resource',
      description: 'Configure how this company uses the Human Resource module.',
      options: [
        {
          key: 'projects',
          label: 'Projects Name',
          description: 'What this company calls a project, shown across the module.',
        },
      ],
    });
  }
  if (marketingEnabled) {
    modules.push({
      key: 'marketing',
      label: 'Marketing',
      description: 'Configure how this company uses the Marketing module.',
      options: [
        {
          key: 'campaign',
          label: 'Campaign Configuration',
          description: 'SMS sender IDs and the SMS credit wallet used by campaigns.',
        },
      ],
    });
  }
  return modules;
}

export function TenantModuleConfigurationTab({
  tenantId,
  marketingEnabled,
  projectsEnabled,
  projectsLabel,
}: TenantModuleConfigurationTabProps) {
  const [moduleKey, setModuleKey] = useState<string | null>(null);
  const [optionKey, setOptionKey] = useState<string | null>(null);

  const modules = configurableModules(marketingEnabled, projectsEnabled);
  // A selection that no longer exists (module switched off while open) falls back to nothing.
  const activeModule = modules.find((m) => m.key === moduleKey);
  const activeOption = activeModule?.options.find((o) => o.key === optionKey);

  function selectModule(key: string) {
    setModuleKey(key);
    setOptionKey(null);
  }

  if (modules.length === 0) {
    return (
      <section className="rounded-card border border-gray-200 bg-white p-5 text-sm text-gray-500">
        No module-specific configuration is available. Enable a module or feature on the Information
        tab to configure it here.
      </section>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-5">
      <aside className="flex w-28 shrink-0 flex-col gap-3 overflow-y-auto">
        {modules.map((module) => {
          const Icon = ModuleIcons[module.key];
          const selected = module.key === activeModule?.key;
          return (
            <button
              key={module.key}
              type="button"
              onClick={() => selectModule(module.key)}
              aria-pressed={selected}
              style={{ '--tile-color': MODULE_COLORS[module.key] } as React.CSSProperties}
              className={cardClass(
                cn(
                  'flex aspect-square w-full flex-col items-center justify-center gap-2 p-3 text-sm font-medium text-gray-700 transition-colors',
                  'hover:border-(--tile-color) hover:text-(--tile-color)',
                  selected &&
                    'border-(--tile-color) text-(--tile-color) ring-1 ring-(--tile-color)',
                ),
              )}
            >
              <Icon className="h-6 w-6" style={{ color: MODULE_COLORS[module.key] }} />
              {module.label}
            </button>
          );
        })}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        <nav aria-label="Module configuration" className="flex items-center gap-2 text-sm">
          {activeModule ? (
            <button
              type="button"
              onClick={() => {
                setModuleKey(null);
                setOptionKey(null);
              }}
              className="text-gray-400 transition-colors hover:text-gray-700"
            >
              {ROOT_LABEL}
            </button>
          ) : (
            <span className="font-medium text-gray-700">{ROOT_LABEL}</span>
          )}
          {activeModule && (
            <>
              <Icons.ChevronRight className="h-4 w-4 text-gray-400" />
              {activeOption ? (
                <button
                  type="button"
                  onClick={() => setOptionKey(null)}
                  className="text-gray-400 transition-colors hover:text-gray-700"
                >
                  {activeModule.label}
                </button>
              ) : (
                <span className="font-medium text-gray-700">{activeModule.label}</span>
              )}
            </>
          )}
          {activeOption && (
            <>
              <Icons.ChevronRight className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-700">{activeOption.label}</span>
            </>
          )}
        </nav>

        {!activeModule ? (
          <p className="rounded-card border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            Select a module to see what can be configured.
          </p>
        ) : !activeOption ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {activeModule.options.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setOptionKey(option.key)}
                style={{ '--tile-color': MODULE_COLORS[activeModule.key] } as React.CSSProperties}
                className={cardClass(
                  'group flex items-center justify-between gap-3 p-5 text-left transition-colors hover:border-(--tile-color)',
                )}
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-900 transition-colors group-hover:text-(--tile-color)">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">{option.description}</span>
                </span>
                <Icons.ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-(--tile-color)" />
              </button>
            ))}
          </div>
        ) : activeOption.key === 'projects' ? (
          <TenantProjectsLabel tenantId={tenantId} savedName={projectsLabel} />
        ) : (
          activeOption.key === 'campaign' && (
            <div className="flex flex-col gap-5">
              <TenantSmsSenderIds tenantId={tenantId} />
              <TenantSmsWallet tenantId={tenantId} />
            </div>
          )
        )}
      </section>
    </div>
  );
}

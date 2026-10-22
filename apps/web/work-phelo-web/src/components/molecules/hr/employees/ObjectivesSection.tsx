'use client';

import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { useAuthStore } from '@/store/auth.store';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { cardClass, cn } from '@/lib/utils';
import { AddObjectivePanel } from '@/components/organisms/hr/performance/AddObjectivePanel';

interface Objective {
  id: string;
  name: string;
  projectName?: string;
  projectObjectiveName?: string;
  createdBy: string;
  kpis: { name: string; done: boolean }[];
}

interface Props {
  projects: { id: string; name: string }[];
}

// Objectives aren't persisted yet — they live in local state until the backend exists.
export function ObjectivesSection({ projects }: Props) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const creatorName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Unknown';

  return (
    <div className="flex flex-col gap-4">
      <div className={cardClass('px-4 py-2 flex items-center justify-between gap-3')}>
        <h3 className="text-sm font-semibold text-gray-900">Objectives</h3>
        <Button onClick={() => setPanelOpen(true)}>
          <Plus className="w-4 h-4" /> Add objective
        </Button>
      </div>

      {objectives.length === 0 ? (
        <div className={cardClass('p-8 text-center text-sm text-gray-400')}>No objectives yet.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,22rem))] gap-4 items-start">
          {objectives.map((o) => (
            <ObjectiveCard
              key={o.id}
              objective={o}
              onAddKpi={(name) =>
                setObjectives((prev) =>
                  prev.map((x) =>
                    x.id === o.id ? { ...x, kpis: [...x.kpis, { name, done: false }] } : x,
                  ),
                )
              }
              onToggleKpi={(index) =>
                setObjectives((prev) =>
                  prev.map((x) =>
                    x.id === o.id
                      ? {
                          ...x,
                          kpis: x.kpis.map((k, i) => (i === index ? { ...k, done: !k.done } : k)),
                        }
                      : x,
                  ),
                )
              }
            />
          ))}
        </div>
      )}

      <AddObjectivePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        projects={projects}
        onSave={(o) =>
          setObjectives((prev) => [
            {
              id: crypto.randomUUID(),
              name: o.name,
              projectName: o.projectName,
              projectObjectiveName: o.projectObjectiveName,
              createdBy: creatorName,
              kpis: o.kpis.map((name) => ({ name, done: false })),
            },
            ...prev,
          ])
        }
      />
    </div>
  );
}

function ObjectiveCard({
  objective,
  onToggleKpi,
  onAddKpi,
}: {
  objective: Objective;
  onAddKpi: (name: string) => void;
  onToggleKpi: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newKpi, setNewKpi] = useState('');
  const total = objective.kpis.length;
  const done = objective.kpis.filter((k) => k.done).length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className={cardClass('flex flex-col')}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-start gap-3 p-5 min-h-32 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{objective.name}</p>
          {objective.projectName && (
            <p className="text-xs text-gray-500 mt-0.5">
              {[objective.projectName, objective.projectObjectiveName].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">Created by {objective.createdBy}</p>
          {!expanded && total > 0 && (
            <p className="text-2xl font-bold text-gray-900 mt-3">{progress}%</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 mt-0.5 text-gray-400 shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-gray-100 p-5">
          {total === 0 ? (
            <p className="text-sm text-gray-400">No KPIs added.</p>
          ) : (
            <>
              <ProgressBar value={progress} />
              <ul className="flex flex-col gap-3">
                {objective.kpis.map((k, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onToggleKpi(i)}
                      className="flex items-center gap-2.5 text-left text-sm"
                    >
                      <span
                        className={cn(
                          'flex w-5 h-5 shrink-0 items-center justify-center rounded border transition-colors',
                          k.done
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 bg-white',
                        )}
                      >
                        {k.done && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className={k.done ? 'text-gray-400 line-through' : 'text-gray-700'}>
                        {k.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newKpi.trim();
              if (!name) return;
              onAddKpi(name);
              setNewKpi('');
            }}
          >
            <input
              value={newKpi}
              onChange={(e) => setNewKpi(e.target.value)}
              placeholder="Add a KPI"
              className="flex-1 min-w-0 rounded-input border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <Button type="submit" variant="outline" disabled={!newKpi.trim()}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

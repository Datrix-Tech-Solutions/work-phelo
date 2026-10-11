'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Skeleton } from '@/components/atoms/Skeleton';
import { ReportBuilderPanel } from '@/components/organisms/hr/reports/ReportBuilderPanel';
import { ReportView } from '@/components/organisms/hr/reports/ReportView';
import { SaveReportModal } from '@/components/organisms/hr/reports/SaveReportModal';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  fetchSavedReport,
  useDeleteSavedReport,
  useReportCatalog,
  useSaveReport,
  useSavedReports,
  useUpdateSavedReport,
} from '@/hooks/hr/useReports';
import { usePermission } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/formatters';
import { Permission } from '@/lib/permissionMap';
import { cardClass } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { ReportSpec, SavedReportSummary } from '@/types/reports';

const TYPE_LABEL = { TABLE: 'Table', CHART: 'Charts' } as const;

export default function HrReportsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const canViewReports = usePermission(Permission.VIEW_HR_REPORTS);

  const { data: catalog } = useReportCatalog();
  const { data: saved = [], isLoading: savedLoading } = useSavedReports();
  const save = useSaveReport();
  const update = useUpdateSavedReport();
  const remove = useDeleteSavedReport();

  const [spec, setSpec] = useState<ReportSpec | null>(null);
  const [opened, setOpened] = useState<SavedReportSummary | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  // Without the permission this page is not theirs: send them back to HR.
  useEffect(() => {
    if (user !== null && !canViewReports) router.replace(`/${tenantSlug}/hr`);
  }, [user, canViewReports, tenantSlug, router]);

  if (!canViewReports) return null;

  // Only the author or an admin may change a saved report; everyone may open it.
  const canChangeOpened =
    !!opened && (user?.role === 'TENANT_ADMIN' || opened.createdBy === user?.id);

  const openSaved = async (id: string) => {
    const summary = saved.find((r) => r.id === id);
    if (!summary) return;
    try {
      const report = await fetchSavedReport(id);
      setOpened(summary);
      setSpec({
        type: report.type,
        period: report.definition.period ?? {},
        blocks: report.definition.blocks,
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'That report could not be opened.'));
    }
  };

  const saveNew = (values: { name: string; description?: string }) => {
    if (!spec) return;
    setSaveError(undefined);
    save.mutate(
      { ...values, spec },
      {
        onSuccess: (report) => {
          toast.success('Report saved');
          setOpened(report);
          setSaveMode(null);
        },
        onError: (error) => setSaveError(apiErrorMessage(error, 'The report could not be saved.')),
      },
    );
  };

  const saveChanges = () => {
    if (!spec || !opened) return;
    update.mutate(
      { id: opened.id, name: opened.name, description: opened.description ?? undefined, spec },
      {
        onSuccess: () => toast.success('Changes saved'),
        onError: (error) => toast.error(apiErrorMessage(error, 'The changes could not be saved.')),
      },
    );
  };

  const confirmDelete = () => {
    if (!opened) return;
    remove.mutate(opened.id, {
      onSuccess: () => {
        toast.success('Report deleted');
        setOpened(null);
        setSpec(null);
        setDeleteOpen(false);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'The report could not be deleted.')),
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-6 pr-6 pl-(--page-pl) flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {opened ? opened.name : 'Reports'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {opened?.description ||
              (opened
                ? `Saved by ${opened.createdByName}`
                : 'Build tables and charts from your HR data')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saved.length > 0 && (
            <div className="w-56">
              <SearchSelect
                placeholder="Saved reports"
                options={saved.map((r) => ({
                  value: r.id,
                  label: r.name,
                  sublabel: `${TYPE_LABEL[r.type]} · ${r.createdByName}`,
                }))}
                value={opened?.id ?? ''}
                onChange={(id) => {
                  if (id) void openSaved(id);
                  else {
                    setOpened(null);
                    setSpec(null);
                  }
                }}
              />
            </div>
          )}
          {spec && opened && canChangeOpened && (
            <Button variant="outline" isLoading={update.isPending} onClick={saveChanges}>
              Save changes
            </Button>
          )}
          {spec && opened && canChangeOpened && (
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          )}
          {spec && (
            <Button variant="outline" onClick={() => setSaveMode('new')}>
              {opened ? 'Save as new' : 'Save report'}
            </Button>
          )}
          <Button onClick={() => setBuilderOpen(true)}>Generate report</Button>
        </div>
      </div>

      {spec ? (
        <ReportView spec={spec} />
      ) : savedLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className={cardClass('flex flex-col items-center gap-3 px-6 py-14 text-center')}>
          <h3 className="text-sm font-semibold text-gray-900">No report yet</h3>
          <p className="max-w-sm text-sm text-gray-500">
            Choose Generate report to build a table or charts from leave, attendance, payroll and
            employee data.
            {saved.length > 0 ? ' Or open one that was saved before.' : ''}
          </p>
          {saved.length > 0 && (
            <div className="mt-2 flex w-full max-w-xl flex-col gap-2 text-left">
              {saved.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => void openSaved(report.id)}
                  className={cardClass(
                    'flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-(--surface-hover,var(--color-gray-100))',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {report.name}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {report.createdByName} · updated {formatDate(report.updatedAt)}
                    </span>
                  </span>
                  <Badge label={TYPE_LABEL[report.type]} variant="info" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ReportBuilderPanel
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        catalog={catalog}
        initial={spec}
        onGenerate={setSpec}
      />

      <SaveReportModal
        isOpen={saveMode === 'new'}
        onClose={() => {
          setSaveMode(null);
          setSaveError(undefined);
        }}
        isSaving={save.isPending}
        error={saveError}
        initialName={opened ? `${opened.name} copy` : ''}
        initialDescription={opened?.description ?? ''}
        onSave={saveNew}
      />

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this report?"
        description="It will be removed for everyone. This can't be undone."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={remove.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      />
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import {
  payrollConfigurationError,
  usePayrollConfigurations,
} from '@/hooks/hr/usePayrollConfigurations';
import { useSavedPayComponents } from '@/hooks/hr/useSavedPayComponents';
import { usePayrollGroups } from '@/hooks/hr/usePayrollGroups';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { toGroupInput, type GroupSettings } from '@/lib/payroll-groups';
import { useToast } from '@/hooks/useToast';
import { useUnsavedChangesGuard } from '@/hooks/hr/useUnsavedChangesGuard';
import { cardClass } from '@/lib/utils';
import { Button } from '@/components/atoms/Button';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { pageContent } from '@/lib/layout';
import {
  DEFAULT_CURRENCY,
  PAYSLIP_TYPES,
  PayrollEngineError,
  calculatePayslip,
  checkConfiguration,
  fromSaved,
  latestVersion,
  sameComponents,
  type ConfigurationVersion,
  type SavedConfiguration,
  newComponent,
  type ComponentTemplate,
  type PayComponent,
  type PayInput,
  type PayInputs,
  type PayrollTemplate,
  type PayslipTypeKey,
  type SavedPayComponent,
  type VariableAmounts,
} from '@/lib/payroll-engine';
import { ComponentList } from './ComponentList';
import { ComponentEditor } from './ComponentEditor';
import { SamplePayslip } from './SamplePayslip';
import { AddComponentModal } from './AddComponentModal';
import { ConfigurationToolbar } from './ConfigurationToolbar';
import { TemplatePickerModal } from './TemplatePickerModal';
import { ConfigurationHistory } from './ConfigurationHistory';
import { ConfirmModal } from './ConfirmModal';
import { SaveConfigurationModal } from './SaveConfigurationModal';

/**
 * Pay components workspace: list on the left, editor in the middle and a live sample
 * payslip on the right. The components form one configuration, saved for one or more payslip
 * types. State lives in the browser for now; the backend comes once the screens are settled.
 */
export function PayComponentsWorkspace() {
  const toast = useToast();
  const savedStore = useSavedPayComponents();
  const configStore = usePayrollConfigurations();
  const groupStore = usePayrollGroups();
  const { data: employeeData } = useAllEmployees();
  const employees = employeeData?.data ?? [];

  const [components, setComponents] = useState<PayComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [previewType, setPreviewType] = useState<PayslipTypeKey>('monthly');
  const [inputs, setInputs] = useState<PayInputs>({ basic: 5000, commission: 10000 });
  const [variables, setVariables] = useState<VariableAmounts>({});
  const [adding, setAdding] = useState(false);
  const [pickingTemplate, setPickingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'configuration' | 'history'>('configuration');

  const type = PAYSLIP_TYPES[previewType];
  const current = configStore.configurations.find((c) => c.id === configId) ?? null;
  // Basic only counts on payslip types that have it; otherwise the preview runs with none.
  const effectiveInputs: PayInputs = {
    basic: type.inputs.includes('basic') ? inputs.basic : 0,
    commission: type.inputs.includes('commission') ? inputs.commission : 0,
  };

  const { result, error } = useMemo(() => {
    try {
      return { result: calculatePayslip(components, effectiveInputs, variables), error: null };
    } catch (e) {
      return {
        result: null,
        error:
          e instanceof PayrollEngineError
            ? e.message
            : 'Something went wrong calculating this payslip.',
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, effectiveInputs.basic, effectiveInputs.commission, variables]);

  const check = useMemo(
    () => checkConfiguration(components, previewType),
    [components, previewType],
  );
  // An engine error is already shown in place of the payslip.
  const previewErrors = check.errors.filter((m) => m !== error);

  const dirty = current
    ? !sameComponents(latestVersion(current).components, components) ||
      current.currency !== currency
    : components.length > 0;

  const selected = components.find((c) => c.id === selectedId) ?? null;

  const update = (next: PayComponent) =>
    setComponents((list) => list.map((c) => (c.id === next.id ? next : c)));

  const addCreated = (created: PayComponent) => {
    setComponents((list) => [...list, created]);
    setSelectedId(created.id);
    setAdding(false);
  };

  const add = (option: ComponentTemplate) =>
    addCreated(newComponent(option, components, type.inputs[0]));

  const addSaved = (entry: SavedPayComponent) => addCreated(fromSaved(entry, components));

  const saveAsNew = async (component: PayComponent) => {
    try {
      const id = await savedStore.saveAsNew(component);
      // Later "Replace current" on this component should update the copy just saved.
      update({ ...component, sourceTemplateId: id });
      toast.success(`Saved "${component.name}" as a new component`);
    } catch (e) {
      toast.error(payrollConfigurationError(e, 'Could not save the component'));
    }
  };

  const replaceSaved = async (component: PayComponent) => {
    if (!component.sourceTemplateId) return;
    try {
      await savedStore.replace(component.sourceTemplateId, component);
      toast.success(`Replaced the saved "${component.name}"`);
    } catch (e) {
      toast.error(payrollConfigurationError(e, 'Could not replace the saved component'));
    }
  };

  const deleteSaved = async (id: string) => {
    try {
      await savedStore.remove(id);
    } catch (e) {
      toast.error(payrollConfigurationError(e, 'Could not delete the saved component'));
    }
  };

  const remove = (id: string) => {
    const index = components.findIndex((c) => c.id === id);
    // Tax credits that pointed at the deleted deduction are left to choose another one.
    const rest = components
      .filter((c) => c.id !== id)
      .map((c) => ({
        ...c,
        reduces: c.reduces === id ? undefined : c.reduces,
        baseComponentId: c.baseComponentId === id ? undefined : c.baseComponentId,
      }));
    setComponents(rest);
    setSelectedId(rest[Math.min(index, rest.length - 1)]?.id ?? null);
  };

  // Switching away with unsaved edits asks first, in the app's own pop-up.
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null);
  const guardUnsaved = (action: () => void) => (dirty ? setPendingDiscard(() => action) : action());
  // Leaving the page with unsaved changes asks in the same pop-up.
  useUnsavedChangesGuard(dirty, (proceed) => setPendingDiscard(() => proceed));

  /** Puts the draft back to the last saved version, or empties it if nothing was saved. */
  const discardChanges = () =>
    setPendingDiscard(() => () => {
      const saved = current
        ? (JSON.parse(JSON.stringify(latestVersion(current).components)) as PayComponent[])
        : [];
      setComponents(saved);
      setCurrency(current?.currency ?? DEFAULT_CURRENCY);
      setSelectedId(saved[0]?.id ?? null);
    });

  const openConfiguration = (id: string) => {
    const target = configStore.configurations.find((c) => c.id === id);
    if (!target || target.id === configId) return;
    guardUnsaved(() => {
      const copy = JSON.parse(JSON.stringify(latestVersion(target).components)) as PayComponent[];
      setComponents(copy);
      setConfigId(target.id);
      setCurrency(target.currency ?? DEFAULT_CURRENCY);
      setSelectedId(copy[0]?.id ?? null);
      if (target.payslipType) setPreviewType(target.payslipType);
    });
  };

  const newConfiguration = () => {
    if (!configId && components.length === 0) return;
    guardUnsaved(() => {
      setComponents([]);
      setConfigId(null);
      setCurrency(DEFAULT_CURRENCY);
      setSelectedId(null);
    });
  };

  /** Begins a new configuration from a template's components, which are then the user's to change. */
  const useTemplate = (template: PayrollTemplate) => {
    setPickingTemplate(false);
    guardUnsaved(() => {
      const built = template.build();
      setComponents(built);
      setConfigId(null);
      setCurrency(template.currency);
      setSelectedId(built[0]?.id ?? null);
      setPreviewType(template.payslipType);
      toast.success(`${template.name} template loaded. Change what you need, then save it.`);
    });
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  /** A new configuration's group that couldn't be created, kept so it can be tried again. */
  const [pendingGroup, setPendingGroup] = useState<{
    configurationId: string;
    name: string;
    settings: GroupSettings;
    /** Set once the group exists, so a retry only has the members left to add. */
    groupId?: string;
    error: string;
  } | null>(null);
  const [retryingGroup, setRetryingGroup] = useState(false);

  /** Creates the group a new configuration comes with, same name and no more than its settings. */
  const createGroup = async (pending: {
    configurationId: string;
    name: string;
    settings: GroupSettings;
    groupId?: string;
  }) => {
    let groupId = pending.groupId;
    try {
      if (!groupId) {
        const saved = await groupStore.save({
          name: pending.name,
          configurationId: pending.configurationId,
          frequency: pending.settings.frequency,
          payday: pending.settings.payday,
          reminder: pending.settings.reminder,
        });
        groupId = saved.id;
      }
      if (pending.settings.memberIds.length > 0) {
        await groupStore.setEmployees(groupId, pending.settings.memberIds);
      }
      setPendingGroup(null);
      return true;
    } catch (e) {
      setPendingGroup({
        ...pending,
        groupId,
        error: payrollConfigurationError(e, 'Could not create the group'),
      });
      return false;
    }
  };

  const retryGroup = async () => {
    if (!pendingGroup) return;
    setRetryingGroup(true);
    const created = await createGroup(pendingGroup);
    setRetryingGroup(false);
    if (created) toast.success(`Created the "${pendingGroup.name}" group`);
  };

  const saveConfiguration = async (input: {
    name: string;
    payslipType: PayslipTypeKey;
    effectiveFrom: string;
    note: string;
    group: GroupSettings;
  }) => {
    setSaveError(null);
    const { group, ...configuration } = input;
    // A configuration and its group share one name (this holds while each has just the one).
    const linkedGroup = configId
      ? groupStore.groups.find((g) => g.configurationId === configId)
      : undefined;
    try {
      // The group goes first: its name has to be unique, so a clash stops here before anything changes.
      if (linkedGroup) {
        await groupStore.save({
          ...toGroupInput(linkedGroup),
          name: configuration.name,
          frequency: group.frequency,
          payday: group.payday,
          reminder: group.reminder,
        });
        const members = employees.filter((e) => e.payrollGroupId === linkedGroup.id);
        const same =
          members.length === group.memberIds.length &&
          members.every((e) => group.memberIds.includes(e.id));
        if (!same) await groupStore.setEmployees(linkedGroup.id, group.memberIds);
      }
      const { id, published } = await configStore.save({
        id: configId ?? undefined,
        ...configuration,
        currency,
        components,
        baseVersion: current ? latestVersion(current).version : undefined,
      });
      setConfigId(id);
      setSaving(false);
      const message = published
        ? `Saved the "${configuration.name}" group as a new version`
        : `Saved the "${configuration.name}" group`;
      if (!linkedGroup) {
        const created = await createGroup({
          configurationId: id,
          name: configuration.name,
          settings: group,
        });
        toast.success(created ? `Created the "${configuration.name}" group` : message);
      } else {
        toast.success(message);
      }
    } catch (e) {
      // Kept in the pop-up, where the person can fix it and try again.
      setSaveError(payrollConfigurationError(e, 'Could not save the group'));
    }
  };

  /** Opens a configuration with an earlier version's components in the draft, to save as a new version. */
  const loadVersion = (configuration: SavedConfiguration, version: ConfigurationVersion) => {
    guardUnsaved(() => {
      const copy = JSON.parse(JSON.stringify(version.components)) as PayComponent[];
      setConfigId(configuration.id);
      setCurrency(configuration.currency ?? DEFAULT_CURRENCY);
      setComponents(copy);
      setSelectedId(copy[0]?.id ?? null);
      if (configuration.payslipType) setPreviewType(configuration.payslipType);
      setTab('configuration');
      toast.success(
        `Version ${version.version} of the "${configuration.name}" group loaded into the draft`,
      );
    });
  };

  const changeInput = (input: PayInput, value: number) =>
    setInputs((previous) => ({ ...previous, [input]: value }));

  return (
    <>
      <TabBar
        tabs={[
          { key: 'configuration', label: 'Configuration' },
          { key: 'history', label: 'History' },
        ]}
        activeTab={tab}
        onTabChange={(key) => setTab(key as 'configuration' | 'history')}
      />
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        {pendingGroup && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              &quot;{pendingGroup.name}&quot; was saved, but the group couldn&apos;t be created:{' '}
              {pendingGroup.error}
            </p>
            <Button size="sm" variant="outline" isLoading={retryingGroup} onClick={retryGroup}>
              Try again
            </Button>
          </div>
        )}
        {tab === 'history' && (
          <ConfigurationHistory
            loading={configStore.isLoading}
            configurations={configStore.configurations}
            currentId={configId}
            draft={components}
            dirty={dirty}
            onLoad={loadVersion}
          />
        )}
        {tab === 'configuration' && (
          <>
            <ConfigurationToolbar
              configurations={configStore.configurations}
              current={current}
              dirty={dirty}
              hasComponents={components.length > 0}
              onOpen={openConfiguration}
              onNew={newConfiguration}
              onTemplate={() => setPickingTemplate(true)}
              onSave={() => setSaving(true)}
              onDiscard={discardChanges}
            />

            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(240px,290px)_minmax(0,1fr)] xl:grid-cols-[minmax(240px,290px)_minmax(0,1fr)_minmax(330px,390px)]">
              <ComponentList
                components={components}
                result={result}
                selectedId={selectedId}
                currency={currency}
                onSelect={setSelectedId}
                onAdd={() => setAdding(true)}
              />

              <section className={cardClass('p-4')} aria-label="Component editor">
                {selected ? (
                  <ComponentEditor
                    key={selected.id}
                    component={selected}
                    all={components}
                    currency={currency}
                    onChange={update}
                    onDelete={() => remove(selected.id)}
                    inputs={type.inputs}
                    saved={savedStore.saved}
                    onSaveAsNew={() => saveAsNew(selected)}
                    onReplaceSaved={() => replaceSaved(selected)}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-gray-500">
                    <p>
                      {components.length === 0
                        ? 'Build the payslip one component at a time.'
                        : 'Select a component to edit it.'}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setAdding(true)}>
                        Add component
                      </Button>
                      {components.length === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPickingTemplate(true)}
                        >
                          Start from a template
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <div className="md:col-span-2 xl:col-span-1">
                <SamplePayslip
                  components={components}
                  result={result}
                  error={error}
                  payslipType={previewType}
                  onCurrencyChange={setCurrency}
                  onTypeChange={setPreviewType}
                  inputs={inputs}
                  onInputChange={changeInput}
                  variables={variables}
                  onVariableChange={(id, value) => setVariables((v) => ({ ...v, [id]: value }))}
                  errors={previewErrors}
                  warnings={check.warnings}
                  reminders={check.reminders}
                  currency={currency}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={pendingDiscard !== null}
        title="Discard unsaved changes?"
        description="You have changes that haven't been saved. Carrying on discards them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setPendingDiscard(null)}
        onConfirm={() => {
          pendingDiscard?.();
          setPendingDiscard(null);
        }}
      />

      <TemplatePickerModal
        isOpen={pickingTemplate}
        onClose={() => setPickingTemplate(false)}
        onPick={useTemplate}
      />

      <AddComponentModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        currency={currency}
        saved={savedStore.saved}
        onPick={add}
        onPickSaved={addSaved}
        onDeleteSaved={deleteSaved}
      />

      {saving && (
        <SaveConfigurationModal
          isOpen
          onClose={() => {
            setSaving(false);
            setSaveError(null);
          }}
          groups={groupStore.groups}
          employees={employees}
          isSaving={configStore.isSaving || groupStore.isSaving}
          error={saveError}
          components={components}
          current={current}
          previewType={previewType}
          onSave={saveConfiguration}
        />
      )}
    </>
  );
}

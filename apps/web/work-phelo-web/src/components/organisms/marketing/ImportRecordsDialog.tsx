'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Modal } from '@/components/organisms/shared/Modal';
import { useGeocodeSearch } from '@/hooks/marketing/useGeocode';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { Draft } from '@/lib/marketing-import/records';
import {
  normalize,
  type ImportRecord,
  type Located,
  type Need,
  type ResolveSetting,
} from '@/lib/marketing-import/shared';
import { cn } from '@/lib/utils';

type Locations = Map<string, Located | null>;

interface Props<P> {
  isOpen: boolean;
  onClose: () => void;
  /** "prospect" or "client", for the wording. */
  noun: string;
  /** False while the lists the template and the checks depend on are still loading. */
  ready: boolean;
  read: (file: File) => Promise<Draft[]>;
  /** Checks a draft; run again after every edit. */
  validate: (draft: Draft, locations: Locations) => ImportRecord<P>;
  /** Looks up places on the map, one lookup per distinct place. */
  locate: (places: string[]) => Promise<Locations>;
  downloadTemplate: () => void;
  /** Creates the settings the records name that do not exist yet. */
  prepare: (needs: Need[]) => Promise<ResolveSetting>;
  create: (payload: P) => Promise<unknown>;
}

type Result = { status: 'created' } | { status: 'failed'; message: string };

const SETTING_LABELS: [Need['slug'], string][] = [
  ['business-types', 'business type'],
  ['source-types', 'source type'],
  ['products', 'product'],
  ['decision-makers', 'role'],
];

const placesOf = (drafts: Draft[]) => drafts.map((d) => d.location.trim()).filter(Boolean);

/** Upload a filled template, fix what is wrong in the preview, then create the records one by one. */
export function ImportRecordsDialog<P>({
  isOpen,
  onClose,
  noun,
  ready,
  read,
  validate,
  locate,
  downloadTemplate,
  prepare,
  create,
}: Props<P>) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [locations, setLocations] = useState<Locations>(new Map());
  /** Rows whose location the user changed; the field stays editable even once the row is valid. */
  const [edited, setEdited] = useState<Record<number, boolean>>({});
  /** Rows the user chose to leave out of the import. */
  const [ignored, setIgnored] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, Result>>({});
  const requested = useRef(new Set<string>());

  const reset = () => {
    setFile(null);
    setDrafts(null);
    setLocations(new Map());
    setEdited({});
    setIgnored({});
    setResults({});
    setIsParsing(false);
    setIsImporting(false);
    requested.current = new Set();
  };

  const handleClose = () => {
    if (isImporting) return;
    reset();
    onClose();
  };

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setResults({});
    setEdited({});
    setIgnored({});
    requested.current = new Set();
    if (!selected) {
      setDrafts(null);
      return;
    }
    setIsParsing(true);
    try {
      const read_ = await read(selected);
      if (read_.length === 0) toast.error('No rows found in this file');
      const places = placesOf(read_);
      places.forEach((p) => requested.current.add(p));
      setLocations(await locate(places));
      setDrafts(read_);
    } catch (error) {
      toast.error(extractError(error, 'Unable to read this file — is it the template?'));
      setDrafts(null);
    } finally {
      setIsParsing(false);
    }
  };

  // A place the user typed in the preview is looked up once, when they leave the field.
  useEffect(() => {
    const fresh = [...new Set(placesOf(drafts ?? []))].filter((p) => !requested.current.has(p));
    if (fresh.length === 0) return;
    fresh.forEach((p) => requested.current.add(p));
    void locate(fresh).then((found) => setLocations((prev) => new Map([...prev, ...found])));
  }, [drafts, locate]);

  const updateLocation = (rowNumber: number, location: string, found?: Located) => {
    if (found) {
      // Picked from the map search, so there is nothing left to look up.
      requested.current.add(location.trim());
      setLocations((prev) => new Map(prev).set(location.trim(), found));
    }
    setEdited((prev) => ({ ...prev, [rowNumber]: true }));
    setDrafts(
      (prev) => prev?.map((d) => (d.rowNumber === rowNumber ? { ...d, location } : d)) ?? null,
    );
  };

  const records = useMemo(
    () => drafts?.map((draft) => validate(draft, locations)) ?? null,
    [drafts, locations, validate],
  );

  const active = records?.filter((r) => !ignored[r.rowNumber]) ?? [];
  const issueCount = active.filter((r) => r.errors.length > 0).length;
  // Records already created (a retry after a partial failure) are never sent again.
  const pending = active.filter((r) => results[r.rowNumber]?.status !== 'created');
  const canImport = issueCount === 0 && pending.length > 0 && !isImporting;
  const plural = pending.length === 1 ? noun : `${noun}s`;
  const ignoredCount = Object.values(ignored).filter(Boolean).length;

  const missing = new Map<string, Need>();
  for (const need of pending.flatMap((r) => r.needs)) {
    missing.set(`${need.slug}|${normalize(need.name)}`, need);
  }
  const createNote = SETTING_LABELS.flatMap(([slug, label]) => {
    const n = [...missing.values()].filter((m) => m.slug === slug).length;
    return n > 0 ? [`${n} ${label}${n === 1 ? '' : 's'}`] : [];
  }).join(', ');

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true);
    const next = { ...results };
    let created = 0;

    let resolve: ResolveSetting;
    try {
      resolve = await prepare(pending.flatMap((r) => r.needs));
    } catch (error) {
      toast.error(
        extractError(
          error,
          'Failed to create the missing business types, sources, products or roles',
        ),
      );
      setIsImporting(false);
      return;
    }

    // One at a time, so a duplicate name in the file is caught by the server's own check.
    for (const record of pending) {
      try {
        await create(record.build!(resolve));
        next[record.rowNumber] = { status: 'created' };
        created += 1;
      } catch (error) {
        next[record.rowNumber] = {
          status: 'failed',
          message: extractError(error, `Failed to create ${noun}`),
        };
      }
    }
    setResults(next);
    setIsImporting(false);

    if (created === pending.length) {
      toast.success(`Imported ${created} ${created === 1 ? noun : `${noun}s`}`);
      reset();
      onClose();
    } else {
      toast.error(`Imported ${created} of ${pending.length} — see errors below`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Import ${noun.charAt(0).toUpperCase()}${noun.slice(1)}s`}
      description={`Upload the filled template to add ${noun}s in bulk. They are assigned to you.`}
      width="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={downloadTemplate}
            disabled={!ready}
          >
            Template
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {records ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!canImport}
              isLoading={isImporting}
              loadingText="Importing…"
            >
              Import {pending.length > 0 ? pending.length : ''} {plural}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <FileUpload
          label="Filled template"
          accept=".xlsx"
          value={file}
          onChange={handleFileChange}
          hint="Only .xlsx files made from the template are supported."
        />

        {isParsing && (
          <p className="text-sm text-gray-500">Reading the file and finding locations…</p>
        )}

        {records && drafts && records.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className={issueCount > 0 ? 'text-xs text-red-600' : 'text-xs text-green-600'}>
              {issueCount > 0
                ? `${issueCount} ${issueCount === 1 ? 'entry needs' : 'entries need'} fixing — correct ${issueCount === 1 ? 'it' : 'them'} below, or ignore ${issueCount === 1 ? 'it' : 'them'}`
                : `${pending.length} ${plural} ready to import`}
              {ignoredCount > 0 && <span className="text-gray-500"> · {ignoredCount} ignored</span>}
            </p>
            {issueCount === 0 && createNote && (
              <p className="text-xs text-gray-500">
                Not in your CRM settings yet, so they will be added: {createNote}.
              </p>
            )}

            <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Row</th>
                    <th className="px-3 py-2 font-semibold">Company</th>
                    <th className="px-3 py-2 font-semibold">Contact</th>
                    <th className="px-3 py-2 font-semibold">Products / services</th>
                    <th className="px-3 py-2 font-semibold">Location</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, i) => {
                    const draft = drafts[i];
                    const result = results[record.rowNumber];
                    // Only the location is editable: it depends on the map lookup, so it is
                    // the one thing in a sheet that can be right and still not be found.
                    const notFound = record.warnings.length > 0;
                    const editLocation =
                      result?.status !== 'created' &&
                      !ignored[record.rowNumber] &&
                      (notFound || edited[record.rowNumber]);
                    return (
                      <RecordRow
                        key={record.rowNumber}
                        record={record}
                        isIgnored={!!ignored[record.rowNumber]}
                        result={result}
                        onToggleIgnore={() =>
                          setIgnored((prev) => ({
                            ...prev,
                            [record.rowNumber]: !prev[record.rowNumber],
                          }))
                        }
                        locationInput={
                          editLocation ? (
                            <LocationPicker
                              value={draft.location}
                              onPick={(value, found) =>
                                updateLocation(draft.rowNumber, value, found)
                              }
                            />
                          ) : null
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RecordRow<P>({
  record,
  isIgnored,
  result,
  onToggleIgnore,
  locationInput,
}: {
  record: ImportRecord<P>;
  isIgnored: boolean;
  result?: Result;
  onToggleIgnore: () => void;
  /** Replaces the plain location text while the location can be corrected. */
  locationInput: React.ReactNode;
}) {
  const invalid = record.errors.length > 0;
  return (
    <tr className={cn('border-t border-gray-100 align-top', isIgnored && 'opacity-50')}>
      <td className="px-3 py-2 text-gray-400">{record.rowNumber}</td>
      <td className="px-3 py-2 text-gray-700">{record.name || '—'}</td>
      <td className="px-3 py-2 text-gray-700">{record.contact || '—'}</td>
      <td className="px-3 py-2 text-gray-700">{record.items || '—'}</td>
      <td className="px-3 py-2 text-gray-700">{locationInput ?? (record.location || '—')}</td>
      <td className="px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          {isIgnored ? (
            <span className="text-gray-500">Ignored — will not be imported</span>
          ) : result?.status === 'created' ? (
            <span className="text-green-600">Created</span>
          ) : result?.status === 'failed' ? (
            <span className="text-red-600">{result.message}</span>
          ) : invalid ? (
            <span className="text-red-600">{record.errors.join('; ')}</span>
          ) : record.warnings.length > 0 ? (
            <span className="text-amber-600">{record.warnings.join('; ')}</span>
          ) : (
            <span className="text-gray-400">Ready</span>
          )}
          {(isIgnored || (result?.status !== 'created' && (invalid || result))) && (
            <button
              type="button"
              onClick={onToggleIgnore}
              className="shrink-0 font-medium text-brand hover:underline"
            >
              {isIgnored ? 'Restore' : 'Ignore'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Searches the map as you type; a place that is not on it can be used as typed. */
function LocationPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (label: string, found?: Located) => void;
}) {
  const [query, setQuery] = useState('');
  const { data: suggestions = [] } = useGeocodeSearch(query);
  const options = [
    ...(value ? [{ value: `typed:${value}`, label: value }] : []),
    ...suggestions.map((s) => ({ value: `${s.lat},${s.lng}`, label: s.placeName })),
  ];

  return (
    <div className="min-w-48">
      <SearchSelect
        size="sm"
        placeholder="Search for a location..."
        options={options}
        value={`typed:${value}`}
        clearable={false}
        onQueryChange={setQuery}
        onChange={(picked) => {
          const option = options.find((o) => o.value === picked);
          if (!option || picked.startsWith('typed:')) return;
          const [latitude, longitude] = picked.split(',').map(Number);
          onPick(option.label, { label: option.label, latitude, longitude });
          setQuery('');
        }}
        emptyState={({ query: typed, close }) => (
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs font-medium text-brand hover:bg-gray-50"
            onClick={() => {
              onPick(typed.trim());
              setQuery('');
              close();
            }}
          >
            Use “{typed.trim()}” as typed
          </button>
        )}
      />
    </div>
  );
}

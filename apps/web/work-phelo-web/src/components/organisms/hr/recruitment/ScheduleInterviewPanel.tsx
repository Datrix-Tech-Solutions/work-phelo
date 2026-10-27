'use client';

import { useState } from 'react';
import { MapPin, Phone, Video, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { candidateFullName } from '@/components/molecules/hr/recruitment/candidateUtils';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useScheduleInterview, useUpdateInterview } from '@/hooks/hr/useRecruitment';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { CandidateInterview, InterviewMode, RecruitmentCandidate } from '@/types/recruitment';

const MEETING_TYPES: { value: InterviewMode; label: string; icon: LucideIcon }[] = [
  { value: 'VIDEO', label: 'Video Interview', icon: Video },
  { value: 'PHONE', label: 'Phone Interview', icon: Phone },
  { value: 'IN_PERSON', label: 'On-site', icon: MapPin },
];

const PLATFORMS = ['Google Meet', 'Zoom', 'Microsoft Teams', 'Other'].map((p) => ({
  value: p,
  label: p,
}));

const DURATIONS = [15, 30, 45, 60, 90, 120].map((m) => ({
  value: String(m),
  label: m < 60 ? `${m} minutes` : m === 60 ? '1 hour' : `${m / 60} hours`,
}));

interface Props {
  /** The candidate to schedule for; the panel is open while this is set. */
  candidate?: RecruitmentCandidate | null;
  /** When set, the panel edits this scheduled interview instead of creating a new one. */
  interview?: CandidateInterview | null;
  /** Instead of a fixed candidate, let the user pick one of these. Opened with `open`. */
  choices?: RecruitmentCandidate[];
  open?: boolean;
  onClose: () => void;
}

export function ScheduleInterviewPanel({
  candidate = null,
  interview = null,
  choices,
  open = false,
  onClose,
}: Props) {
  const isOpen = choices ? open : !!candidate;

  // Keep the last values so the form stays populated while the panel slides out, and count
  // openings so a picker form starts blank each time.
  const [shown, setShown] = useState({
    candidate,
    interview,
    choices,
    openings: 0,
    wasOpen: false,
  });
  if (isOpen && !shown.wasOpen) {
    setShown({ candidate, interview, choices, openings: shown.openings + 1, wasOpen: true });
  } else if (isOpen && (candidate !== shown.candidate || interview !== shown.interview)) {
    setShown({ ...shown, candidate, interview });
  } else if (!isOpen && shown.wasOpen) {
    setShown({ ...shown, wasOpen: false });
  }
  if (shown.openings === 0) return null;

  return (
    <ScheduleInterviewContent
      key={`${shown.openings}:${shown.candidate?.id ?? 'pick'}:${shown.interview?.id ?? 'new'}`}
      candidate={shown.candidate}
      choices={shown.choices}
      interview={shown.interview}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}

/** Splits an ISO instant into the local date (YYYY-MM-DD) and time (HH:mm) the form edits. */
function localDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

type Errors = Partial<
  Record<
    | 'candidate'
    | 'platform'
    | 'otherPlatform'
    | 'link'
    | 'phone'
    | 'location'
    | 'date'
    | 'time'
    | 'duration',
    string
  >
>;

function ScheduleInterviewContent({
  candidate: fixedCandidate,
  choices,
  interview,
  isOpen,
  onClose,
}: {
  candidate: RecruitmentCandidate | null;
  choices?: RecruitmentCandidate[];
  interview: CandidateInterview | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [chosenId, setChosenId] = useState('');
  const candidate = fixedCandidate ?? choices?.find((c) => c.id === chosenId) ?? null;
  const { mutate: schedule, isPending: isScheduling } = useScheduleInterview();
  const { mutate: update, isPending: isUpdating } = useUpdateInterview();
  const mutate = interview
    ? (input: Parameters<typeof schedule>[0], opts: Parameters<typeof schedule>[1]) =>
        update({ ...input, interviewId: interview.id }, opts)
    : schedule;
  const isPending = isScheduling || isUpdating;

  const initial = interview ? localDateTime(interview.scheduledAt) : null;
  const knownPlatform = PLATFORMS.some((p) => p.value === interview?.platform);
  const durationOptions =
    interview && !DURATIONS.some((d) => d.value === String(interview.durationMinutes))
      ? [
          ...DURATIONS,
          {
            value: String(interview.durationMinutes),
            label: `${interview.durationMinutes} minutes`,
          },
        ].sort((a, b) => Number(a.value) - Number(b.value))
      : DURATIONS;

  const [mode, setMode] = useState<InterviewMode>(interview?.mode ?? 'VIDEO');
  const [platform, setPlatform] = useState(
    interview?.platform ? (knownPlatform ? interview.platform : 'Other') : '',
  );
  const [otherPlatform, setOtherPlatform] = useState(
    interview?.platform && !knownPlatform ? interview.platform : '',
  );
  const [link, setLink] = useState(interview?.meetingLink ?? '');
  const [phone, setPhone] = useState(interview?.phone ?? '');
  const [location, setLocation] = useState(interview?.location ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [startTime, setStartTime] = useState(initial?.time ?? '');
  const [duration, setDuration] = useState(interview ? String(interview.durationMinutes) : '');
  const [notes, setNotes] = useState(interview?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const clear = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined }));

  // Lock mode lets several interviews be scheduled in one sitting; Continue clears the form.
  const entry = useMultiEntryPanel({
    isOpen,
    onStop: onClose,
    onContinue: () => {
      setChosenId('');
      setMode('VIDEO');
      setPlatform('');
      setOtherPlatform('');
      setLink('');
      setPhone('');
      setLocation('');
      setDate('');
      setStartTime('');
      setDuration('');
      setNotes('');
      setErrors({});
    },
  });

  const validate = () => {
    const e: Errors = {};
    if (!candidate) e.candidate = 'Select a candidate';
    if (mode === 'VIDEO') {
      if (!platform) e.platform = 'Select a meeting platform';
      if (platform === 'Other' && !otherPlatform.trim())
        e.otherPlatform = 'Enter the meeting platform';
      if (!link.trim()) e.link = 'Meeting link is required';
      else if (!/^https?:\/\/\S+$/i.test(link.trim()))
        e.link = 'Enter a valid link starting with http:// or https://';
    }
    if (mode === 'PHONE' && !phone) e.phone = 'Phone number is required';
    if (mode === 'IN_PERSON' && !location.trim()) e.location = 'Location is required';
    if (!date) e.date = 'Date is required';
    if (!startTime) e.time = 'Start time is required';
    if (!duration) e.duration = 'Select a duration';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate() || !candidate) return;
    mutate(
      {
        candidateId: candidate.id,
        mode,
        platform:
          mode === 'VIDEO' ? (platform === 'Other' ? otherPlatform.trim() : platform) : null,
        meetingLink: mode === 'VIDEO' ? link.trim() : null,
        phone: mode === 'PHONE' ? phone : null,
        location: mode === 'IN_PERSON' ? location.trim() : null,
        date,
        startTime,
        durationMinutes: Number(duration),
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          if (interview) {
            toast.success('Interview updated');
            onClose();
            return;
          }
          const who = candidateFullName(candidate);
          entry.finishSave(
            { title: 'Interview Scheduled!', message: `An interview has been set up for ${who}.` },
            () => {
              toast.success('Interview scheduled');
              onClose();
            },
          );
        },
        onError: (err) =>
          toast.error(
            extractError(
              err,
              interview ? 'Failed to update interview' : 'Failed to schedule interview',
            ),
          ),
      },
    );
  };

  const fieldError = (message?: string) =>
    message ? <p className="text-xs text-red-500 mt-0.5">{message}</p> : null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      {...(interview ? {} : entry.panelProps)}
      title={interview ? 'Edit Interview' : 'Schedule Interview'}
      description={
        interview
          ? 'Change the details of this interview.'
          : 'Set up an interview with this candidate.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            isLoading={isPending}
            loadingText={interview ? 'Saving…' : 'Scheduling…'}
          >
            {interview ? 'Save Changes' : 'Schedule Interview'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <div className="grid grid-cols-2 gap-4">
          {choices ? (
            <div>
              <SearchSelect
                label="Candidate"
                placeholder="Select candidate"
                options={choices.map((c) => ({
                  value: c.id,
                  label: candidateFullName(c),
                  sublabel: c.currentStage?.name ?? undefined,
                }))}
                value={chosenId}
                clearable={false}
                onChange={(v) => {
                  setChosenId(v);
                  clear('candidate');
                }}
              />
              {fieldError(errors.candidate)}
            </div>
          ) : (
            <Input
              label="Candidate"
              value={candidate ? candidateFullName(candidate) : ''}
              disabled
              readOnly
            />
          )}
          <Input
            label="Job Position"
            value={candidate?.vacancy.title ?? choices?.[0]?.vacancy.title ?? '—'}
            disabled
            readOnly
          />
        </div>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <span className="block truncate text-sm font-bold text-gray-900">Meeting Type</span>
          <div className="grid grid-cols-3 gap-3">
            {MEETING_TYPES.map(({ value, label, icon: Icon }) => {
              const selected = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMode(value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-input border px-3 py-2.5 text-sm font-medium transition-colors',
                    selected
                      ? 'border-(--module-btn-bg,var(--color-brand)) bg-(--module-btn-bg,var(--color-brand)) text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === 'VIDEO' && (
          <div className={cn('grid gap-4', platform === 'Other' ? 'grid-cols-3' : 'grid-cols-2')}>
            <div>
              <SearchSelect
                label="Meeting Platform"
                placeholder="Select platform"
                options={PLATFORMS}
                value={platform}
                clearable={false}
                onChange={(v) => {
                  setPlatform(v);
                  clear('platform');
                }}
              />
              {fieldError(errors.platform)}
            </div>
            {platform === 'Other' && (
              <Input
                label="Platform Name"
                placeholder="e.g. Skype"
                value={otherPlatform}
                error={errors.otherPlatform}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setOtherPlatform(e.target.value);
                  clear('otherPlatform');
                }}
              />
            )}
            <Input
              label="Link"
              placeholder="https://"
              value={link}
              error={errors.link}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setLink(e.target.value);
                clear('link');
              }}
            />
          </div>
        )}

        {mode === 'PHONE' && (
          <PhoneInput
            label="Phone Number"
            value={phone}
            error={errors.phone}
            onChange={(v) => {
              setPhone(v);
              clear('phone');
            }}
          />
        )}

        {mode === 'IN_PERSON' && (
          <Input
            label="Location"
            placeholder="e.g. Head Office, Accra — 3rd floor"
            value={location}
            error={errors.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setLocation(e.target.value);
              clear('location');
            }}
          />
        )}

        <div className="grid grid-cols-3 gap-4">
          <DatePicker
            label="Date"
            value={date}
            disablePast
            error={errors.date}
            onChange={(v) => {
              setDate(v);
              clear('date');
            }}
          />
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="block truncate text-sm font-bold text-gray-900">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                clear('time');
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            {fieldError(errors.time)}
          </div>
          <div>
            <SearchSelect
              label="Duration"
              placeholder="Select"
              options={durationOptions}
              value={duration}
              clearable={false}
              onChange={(v) => {
                setDuration(v);
                clear('duration');
              }}
            />
            {fieldError(errors.duration)}
          </div>
        </div>

        <Input
          type="textarea"
          label="Notes"
          rows={4}
          maxLength={1000}
          placeholder="Anything the interviewers or candidate should know"
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
        />
      </div>
    </SidePanel>
  );
}

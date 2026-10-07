'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { Icons } from '@/components/atoms/icons';
import { MapPin } from 'lucide-react';
import { useGeocodeSearch } from '@/hooks';
import { useDestinationPicker } from '@/hooks/marketing/useDestinationPicker';
import {
  useCreateRequest,
  useRequestFormOptions,
  useUpdateRequest,
} from '@/hooks/marketing/useRequests';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatAppointmentTime } from '@/lib/appointments';
import { formatDate } from '@/lib/formatters';
import { PURPOSE_OPTIONS } from '@/lib/requestOptions';
import { inputClass } from '@/lib/utils';
import type {
  Appointment,
  DestinationOption,
  TransportPurpose,
  TransportRequest,
} from '@/types/marketing';

interface FormValues {
  purpose: TransportPurpose;
  /** Typed destination and purpose, used instead of the client/prospect picker on personal trips. */
  destination: string;
  travelDate: string;
  departureTime: string;
  /** Optional: blank means no planned return, and the trip stays out until it is completed. */
  returnTime: string;
  passengerIds: string[];
  notes: string;
}

type FormErrors = Partial<
  Record<'destination' | 'travelDate' | 'departureTime' | 'returnTime', string>
>;

/** Local today as YYYY-MM-DD. */
const todayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** A fresh form: today's date is worked out when the form opens, not when the page loaded. */
const emptyValues = (): FormValues => ({
  purpose: 'MARKETING',
  destination: '',
  travelDate: todayIso(),
  departureTime: '',
  returnTime: '',
  passengerIds: [],
  notes: '',
});

/** The places already saved on a request, in the shape the picker works with. */
const savedPlaces = (request: TransportRequest): DestinationOption[] =>
  request.stops.map((stop) => ({
    kind: stop.kind,
    id: stop.refId,
    name: stop.name,
    locationLabel: stop.locationLabel,
    latitude: stop.latitude,
    longitude: stop.longitude,
  }));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">{children}</p>
  );
}

const textareaClass =
  'w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** When set the panel edits this (pending) request; otherwise it raises a new one. */
  request?: TransportRequest | null;
  /**
   * When set the panel raises a trip for this approved appointment: the purpose is fixed to
   * marketing and its prospect is a fixed destination, with room to add more.
   */
  appointment?: Appointment | null;
}

export function RequestPanel({ isOpen, onClose, request, appointment }: Props) {
  const toast = useToast();
  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();
  const { data: options } = useRequestFormOptions(isOpen);
  const isEdit = !!request;
  const isPending = createRequest.isPending || updateRequest.isPending;

  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<FormErrors>({});
  // The appointment's prospect is already a destination, so it can't be picked again.
  const appointmentProspectId = appointment?.prospectId;
  const fixedPlace = useMemo(
    () => (appointmentProspectId ? [{ kind: 'PROSPECT', id: appointmentProspectId }] : []),
    [appointmentProspectId],
  );
  const destinations = useDestinationPicker([], fixedPlace);
  // Re-seed the form whenever the panel opens for a different request (or for create).
  const seedKey = isOpen
    ? (request?.id ?? (appointment ? `appointment:${appointment.id}` : 'new'))
    : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    setErrors({});
    destinations.reset(request ? savedPlaces(request) : []);
    setValues(
      request
        ? {
            purpose: request.purpose,
            destination: request.purpose !== 'MARKETING' ? request.destination : '',
            travelDate: request.travelDate,
            departureTime: request.departureTime,
            returnTime: request.returnTime ?? '',
            passengerIds: request.passengers.map((p) => p.employeeId),
            notes: request.notes ?? '',
          }
        : appointment
          ? {
              ...emptyValues(),
              // A trip for an appointment is a marketing trip, on the appointment's day (or today
              // if that has passed, since a request can't be for the past).
              purpose: 'MARKETING',
              travelDate: appointment.date > todayIso() ? appointment.date : todayIso(),
            }
          : emptyValues(),
    );
  }

  const passengerOptions = useMemo(
    () =>
      (options?.employees ?? []).map((employee) => ({
        value: employee.employeeId,
        label: employee.name,
        sublabel: [employee.jobTitle, employee.department].filter(Boolean).join(' · ') || undefined,
      })),
    [options],
  );
  // Saved passengers may no longer be selectable (e.g. left the company), so fall back to the saved copy.
  const selectedPassengers = values.passengerIds.map(
    (id) =>
      options?.employees.find((employee) => employee.employeeId === id) ??
      request?.passengers.find((passenger) => passenger.employeeId === id) ?? {
        employeeId: id,
        name: 'Unknown employee',
        department: null,
        jobTitle: null,
      },
  );

  const isPersonal = values.purpose === 'PERSONAL';
  // Personal and operations trips store a typed or searched destination instead of clients/prospects.
  const usesPlaceText = values.purpose !== 'MARKETING';

  // Operations trips pick a place by searching as they type, like the prospect location search.
  const [placeQuery, setPlaceQuery] = useState('');
  const { data: placeSuggestions = [] } = useGeocodeSearch(placeQuery);
  const placeOptions = useMemo(() => {
    const names = placeSuggestions.map((place) => place.placeName);
    // The chosen place may not be in the live suggestions, so keep it so its label still shows.
    const all = values.destination ? [values.destination, ...names] : names;
    return [...new Set(all)].map((name) => ({ value: name, label: name }));
  }, [placeSuggestions, values.destination]);

  const requester = request
    ? { name: request.requester.name, department: request.requester.department }
    : options?.requester;

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (usesPlaceText && !values.destination.trim()) {
      next.destination = isPersonal
        ? 'Destination and purpose is required.'
        : 'Destination is required.';
    }
    if (!values.travelDate) next.travelDate = 'Travel date is required.';
    if (!values.departureTime) next.departureTime = 'Departure time is required.';
    // The return time is optional, but when given it must come after the departure.
    if (values.departureTime && values.returnTime && values.returnTime <= values.departureTime) {
      next.returnTime = 'Return time must be after the departure time.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const common = {
      purpose: values.purpose,
      travelDate: values.travelDate,
      departureTime: values.departureTime,
      passengerIds: values.passengerIds,
    };
    const notes = values.notes.trim();

    if (request) {
      updateRequest.mutate(
        {
          id: request.id,
          ...common,
          notes,
          // Clearing the field removes the return time.
          returnTime: values.returnTime || null,
          // Personal trips type their destination; picked places are dropped.
          // Otherwise stops are only sent when changed, so an older request's typed destination is left alone.
          ...(usesPlaceText
            ? { destination: values.destination.trim(), stops: [] }
            : destinations.touched || request.purpose !== 'MARKETING'
              ? { stops: destinations.refs }
              : {}),
        },
        {
          onSuccess: () => {
            toast.success('Request updated');
            onClose();
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update request')),
        },
      );
      return;
    }

    createRequest.mutate(
      {
        ...common,
        ...(appointment ? { appointmentId: appointment.id } : {}),
        ...(notes ? { notes } : {}),
        ...(values.returnTime ? { returnTime: values.returnTime } : {}),
        ...(usesPlaceText
          ? { destination: values.destination.trim() }
          : destinations.refs.length
            ? { stops: destinations.refs }
            : {}),
      },
      {
        onSuccess: () => {
          toast.success('Request submitted for approval');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to submit request')),
      },
    );
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Request' : 'New Request'}
      description={
        isEdit
          ? 'Changes are allowed while the request is pending.'
          : 'Raise a transport request. It goes to pending until it is approved.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isPending} loadingText="Saving…">
            {isEdit ? 'Save Changes' : 'Send Request'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <SectionTitle>Requester</SectionTitle>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Name</label>
            <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-600 select-none">
              {requester?.name ?? '…'}
            </div>
          </div>
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Department</label>
            <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-600 select-none">
              {requester ? (requester.department ?? '—') : '…'}
            </div>
          </div>
        </div>

        <SectionTitle>Trip</SectionTitle>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Purpose</label>
          {appointment ? (
            <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-600 select-none">
              Marketing
            </div>
          ) : (
            <SegmentedToggle
              value={values.purpose}
              onChange={(v) => set('purpose', v)}
              options={PURPOSE_OPTIONS}
            />
          )}
        </div>

        {values.purpose === 'OPERATIONS' ? (
          <SearchSelect
            label="Destination"
            placeholder="Search for a location..."
            options={placeOptions}
            value={values.destination}
            onChange={(v) => {
              set('destination', v);
              setPlaceQuery('');
            }}
            onQueryChange={setPlaceQuery}
            error={errors.destination}
          />
        ) : isPersonal ? (
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Destination and purpose</label>
            <input
              type="text"
              placeholder="Where are you going and why?"
              value={values.destination}
              onChange={(e) => set('destination', e.target.value)}
              maxLength={500}
              className={inputClass(errors.destination)}
            />
            {errors.destination && <p className="text-xs text-red-500">{errors.destination}</p>}
          </div>
        ) : (
          <>
            {appointment && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-900">Appointment</label>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {appointment.prospectName}
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-tight text-gray-400">
                      Prospect
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(appointment.date)} · {formatAppointmentTime(appointment)}
                  </p>
                </div>
              </div>
            )}

            <MultiSelect
              label={
                appointment
                  ? 'Add more destinations (optional)'
                  : 'Destination (client or prospect)'
              }
              placeholder={destinations.isLoading ? 'Loading…' : 'Search clients and prospects'}
              options={destinations.options}
              value={destinations.selectedKeys}
              onChange={destinations.onChange}
              onQueryChange={destinations.setSearch}
              hideChips
            />

            {destinations.selected.length > 0 && (
              <div className="flex flex-col gap-2">
                {destinations.selected.map((place) => (
                  <div
                    key={`${place.kind}:${place.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {place.name}
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-tight text-gray-400">
                          {place.kind === 'CLIENT' ? 'Client' : 'Prospect'}
                        </span>
                      </p>
                      <p className="flex items-center gap-1 text-xs text-gray-500 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {place.locationLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => destinations.remove(place)}
                      className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Icons.X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {destinations.isEmpty && (
              <p className="text-xs text-gray-400 -mt-2">
                You have no clients or prospects to choose from. The destination can be left blank.
              </p>
            )}
            {request &&
              request.stops.length === 0 &&
              request.destination &&
              !destinations.touched && (
                <p className="text-xs text-gray-500 -mt-2">
                  Previously entered: {request.destination}
                </p>
              )}
          </>
        )}

        <DatePicker
          label="Travel Date"
          value={values.travelDate}
          onChange={(v) => set('travelDate', v)}
          error={errors.travelDate}
          // Keep a saved past date selectable when editing; only block new past dates.
          minDate={
            isEdit && request && request.travelDate < todayIso() ? request.travelDate : todayIso()
          }
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Expected Departure</label>
            <input
              type="time"
              value={values.departureTime}
              onChange={(e) => set('departureTime', e.target.value)}
              className={inputClass(errors.departureTime)}
            />
            {errors.departureTime && <p className="text-xs text-red-500">{errors.departureTime}</p>}
          </div>
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Expected Return (optional)</label>
            <input
              type="time"
              value={values.returnTime}
              onChange={(e) => set('returnTime', e.target.value)}
              className={inputClass(errors.returnTime)}
            />
            {errors.returnTime && <p className="text-xs text-red-500">{errors.returnTime}</p>}
          </div>
        </div>

        <SectionTitle>Passengers</SectionTitle>

        <MultiSelect
          label="Travelling With (optional)"
          placeholder="Select colleagues"
          options={passengerOptions}
          value={values.passengerIds}
          onChange={(v) => set('passengerIds', v)}
          hideChips
        />

        {selectedPassengers.length > 0 && (
          <div className="flex flex-col gap-2">
            {selectedPassengers.map((person) => (
              <div
                key={person.employeeId}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {[person.jobTitle, person.department].filter(Boolean).join(' · ') ||
                      'No role or department on record'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      'passengerIds',
                      values.passengerIds.filter((id) => id !== person.employeeId),
                    )
                  }
                  className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>Notes</SectionTitle>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Notes (optional)</label>
          <textarea
            rows={3}
            placeholder="Anything the approver should know…"
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            className={textareaClass}
          />
        </div>
      </div>
    </SidePanel>
  );
}

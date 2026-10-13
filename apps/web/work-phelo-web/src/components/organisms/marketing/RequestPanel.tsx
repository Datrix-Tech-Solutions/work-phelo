'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { Icons } from '@/components/atoms/icons';
import { MapPin } from 'lucide-react';
import { useGeocodeSearch } from '@/hooks';
import { useDestinationPicker } from '@/hooks/marketing/useDestinationPicker';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import {
  useApproveRequest,
  useCreateRequest,
  useRequestAvailability,
  useRequestFormOptions,
  useUpdateRequest,
} from '@/hooks/marketing/useRequests';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatAppointmentTime } from '@/lib/appointments';
import { formatDate } from '@/lib/formatters';
import { ALLOCATION_BLOCK_TAGS, PURPOSE_OPTIONS } from '@/lib/requestOptions';
import { cn, inputClass } from '@/lib/utils';
import type {
  Appointment,
  DestinationOption,
  TransportPurpose,
  TransportRequest,
} from '@/types/marketing';

interface FormValues {
  purpose: TransportPurpose;
  /** Place searched for on miscellaneous trips, used instead of the client/prospect picker. Optional. */
  destination: string;
  /** What a miscellaneous trip is for. Optional. */
  tripPurpose: string;
  travelDate: string;
  departureTime: string;
  /** Optional: blank means no planned return, and the trip stays out until it is completed. */
  returnTime: string;
  passengerIds: string[];
  notes: string;
  /** Optional asks for the approver: a vehicle, and either a driver or driving themselves. */
  vehicleAssetId: string;
  driverEmployeeId: string;
  selfDriven: boolean;
}

type FormErrors = Partial<
  Record<'travelDate' | 'departureTime' | 'returnTime' | 'vehicle' | 'driver', string>
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
  tripPurpose: '',
  travelDate: todayIso(),
  departureTime: '',
  returnTime: '',
  passengerIds: [],
  notes: '',
  vehicleAssetId: '',
  driverEmployeeId: '',
  selfDriven: false,
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
  /**
   * When given, and the person can approve, the panel offers Send & Approve: the request is raised
   * and approved with the chosen vehicle and driver in one go, then handed to this.
   */
  onApproved?: (request: TransportRequest) => void;
}

export function RequestPanel({ isOpen, onClose, request, appointment, onApproved }: Props) {
  const toast = useToast();
  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();
  const approveRequest = useApproveRequest();
  const canApprove = usePermissionRule('marketing.requests.all:APPROVE');
  const [isApproving, setIsApproving] = useState(false);
  const { data: options } = useRequestFormOptions(isOpen);
  const isEdit = !!request;
  const isPending = createRequest.isPending || updateRequest.isPending || isApproving;

  const [values, setValues] = useState<FormValues>(emptyValues);
  // Driving yourself needs an unexpired driver's licence with its image on file, which the server
  // works out; until it has answered the toggle stays off.
  const canDriveSelf = options?.requester.canDriveSelf ?? false;
  const licence = options?.requester.licence;
  const selfDriven = canDriveSelf && values.selfDriven;
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
            // Operations and personal trips are both miscellaneous now.
            purpose: request.purpose === 'MARKETING' ? 'MARKETING' : 'OPERATIONS',
            destination: request.purpose !== 'MARKETING' ? request.destination : '',
            tripPurpose: request.businessPurpose ?? '',
            travelDate: request.travelDate,
            departureTime: request.departureTime,
            returnTime: request.returnTime ?? '',
            passengerIds: request.passengers.map((p) => p.employeeId),
            notes: request.notes ?? '',
            vehicleAssetId: request.requested?.vehicle?.assetId ?? '',
            driverEmployeeId: request.requested?.driver?.employeeId ?? '',
            selfDriven: request.requested?.selfDriven ?? false,
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

  // Which vehicles and drivers are free is checked once the date and departure are known. It is
  // only a hint: the approver decides, and two requesters can ask for the same free vehicle.
  const windowValid =
    !!values.travelDate &&
    !!values.departureTime &&
    (!values.returnTime || values.returnTime > values.departureTime);
  const { data: availability } = useRequestAvailability(
    isOpen && windowValid
      ? {
          travelDate: values.travelDate,
          departureTime: values.departureTime,
          ...(values.returnTime ? { returnTime: values.returnTime } : {}),
        }
      : null,
  );
  const vehicleStatus = useMemo(
    () => new Map((availability?.vehicles ?? []).map((v) => [v.assetId, v])),
    [availability],
  );
  const driverStatus = useMemo(
    () => new Map((availability?.drivers ?? []).map((d) => [d.employeeId, d])),
    [availability],
  );

  // A saved choice may have left the lists (e.g. the vehicle went into maintenance); keep it visible.
  // Unavailable ones stay in the list, greyed out and tagged with why, after the ones that can be picked.
  const vehicleOptions = useMemo(() => {
    const listed = (options?.vehicles ?? []).map((v) => {
      const status = vehicleStatus.get(v.assetId);
      return {
        value: v.assetId,
        label: v.name,
        sublabel: v.assetNumber,
        disabled: status ? !status.available : false,
        tag: status?.unavailableKind ? ALLOCATION_BLOCK_TAGS[status.unavailableKind] : undefined,
      };
    });
    const saved = request?.requested?.vehicle;
    const all =
      saved && !listed.some((o) => o.value === saved.assetId)
        ? [
            {
              value: saved.assetId,
              label: saved.name ?? 'Unknown vehicle',
              sublabel: undefined,
              disabled: false,
              tag: undefined,
            },
            ...listed,
          ]
        : listed;
    return all.sort((a, b) => Number(a.disabled) - Number(b.disabled));
  }, [options, request, vehicleStatus]);
  const driverOptions = useMemo(() => {
    const listed = (options?.drivers ?? []).map((d) => {
      const status = driverStatus.get(d.employeeId);
      return {
        value: d.employeeId,
        label: d.name,
        sublabel: d.department ?? undefined,
        disabled: status ? !status.available : false,
        tag: status?.unavailableKind ? ALLOCATION_BLOCK_TAGS[status.unavailableKind] : undefined,
      };
    });
    const saved = request?.requested?.driver;
    const all =
      saved && !listed.some((o) => o.value === saved.employeeId)
        ? [
            {
              value: saved.employeeId,
              label: saved.name ?? 'Unknown driver',
              sublabel: undefined,
              disabled: false,
              tag: undefined,
            },
            ...listed,
          ]
        : listed;
    return all.sort((a, b) => Number(a.disabled) - Number(b.disabled));
  }, [options, request, driverStatus]);

  // A choice that stops being available (e.g. after changing the date) is dropped, not sent.
  const pickedVehicle = vehicleOptions.some((o) => o.value === values.vehicleAssetId && !o.disabled)
    ? values.vehicleAssetId
    : '';
  const pickedDriver = driverOptions.some((o) => o.value === values.driverEmployeeId && !o.disabled)
    ? values.driverEmployeeId
    : '';
  const vehicleLost = !!values.vehicleAssetId && !!availability && !pickedVehicle;
  const driverLost = !!values.driverEmployeeId && !selfDriven && !!availability && !pickedDriver;

  // Miscellaneous trips store a searched destination instead of clients/prospects.
  const usesPlaceText = values.purpose !== 'MARKETING';

  // Miscellaneous trips pick a place by searching as they type, like the prospect location search.
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

  /** `forApproval` also needs the vehicle and driver, since approving allocates them. */
  function validate(forApproval = false): boolean {
    const next: FormErrors = {};
    if (!values.travelDate) next.travelDate = 'Travel date is required.';
    if (!values.departureTime) next.departureTime = 'Departure time is required.';
    // The return time is optional, but when given it must come after the departure.
    if (values.departureTime && values.returnTime && values.returnTime <= values.departureTime) {
      next.returnTime = 'Return time must be after the departure time.';
    }
    if (forApproval) {
      if (!pickedVehicle) next.vehicle = 'Select a vehicle to approve the trip.';
      if (!selfDriven && !pickedDriver) {
        next.driver = 'Select a driver, or mark the trip as self-driven.';
      }
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
    // Self-driving and a named driver exclude each other.
    const driverAsk = selfDriven
      ? { preferredSelfDriven: true }
      : pickedDriver
        ? { preferredDriverEmployeeId: pickedDriver }
        : {};

    if (request) {
      updateRequest.mutate(
        {
          id: request.id,
          ...common,
          notes,
          // Clearing the field removes the return time.
          returnTime: values.returnTime || null,
          // Clearing a choice removes it.
          preferredVehicleAssetId: pickedVehicle || null,
          preferredSelfDriven: selfDriven,
          preferredDriverEmployeeId: selfDriven ? null : pickedDriver || null,
          // Miscellaneous trips search for a destination and say what the trip is for; picked
          // places are dropped. A marketing trip clears any purpose text left from before.
          // Otherwise stops are only sent when changed, so an older request's typed destination is left alone.
          businessPurpose: usesPlaceText ? values.tripPurpose.trim() : '',
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
        ...(pickedVehicle ? { preferredVehicleAssetId: pickedVehicle } : {}),
        ...driverAsk,
        ...(usesPlaceText
          ? {
              ...(values.destination.trim() ? { destination: values.destination.trim() } : {}),
              ...(values.tripPurpose.trim() ? { businessPurpose: values.tripPurpose.trim() } : {}),
            }
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

  async function handleSendAndApprove() {
    if (!validate(true)) return;
    const notes = values.notes.trim();
    setIsApproving(true);
    let created: TransportRequest;
    try {
      created = await createRequest.mutateAsync({
        purpose: values.purpose,
        travelDate: values.travelDate,
        departureTime: values.departureTime,
        passengerIds: values.passengerIds,
        ...(notes ? { notes } : {}),
        ...(values.returnTime ? { returnTime: values.returnTime } : {}),
        preferredVehicleAssetId: pickedVehicle,
        ...(selfDriven
          ? { preferredSelfDriven: true }
          : { preferredDriverEmployeeId: pickedDriver }),
        ...(usesPlaceText
          ? {
              ...(values.destination.trim() ? { destination: values.destination.trim() } : {}),
              ...(values.tripPurpose.trim() ? { businessPurpose: values.tripPurpose.trim() } : {}),
            }
          : destinations.refs.length
            ? { stops: destinations.refs }
            : {}),
      });
    } catch (error) {
      setIsApproving(false);
      toast.error(apiErrorMessage(error, 'Failed to submit request'));
      return;
    }
    try {
      const approved = await approveRequest.mutateAsync({
        id: created.id,
        vehicleAssetId: pickedVehicle,
        ...(selfDriven ? { selfDriven: true } : { driverEmployeeId: pickedDriver }),
      });
      onClose();
      onApproved?.(approved);
    } catch (error) {
      // The request exists and is pending, so it can still be approved from the list.
      toast.error(
        `Request sent, but it could not be approved: ${apiErrorMessage(error, 'try again from the list')}`,
      );
      onClose();
    } finally {
      setIsApproving(false);
    }
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

          <Button
            onClick={handleSubmit}
            disabled={isApproving}
            isLoading={createRequest.isPending || updateRequest.isPending}
            loadingText="Saving…"
          >
            {isEdit ? 'Save Changes' : 'Send Request'}
          </Button>
          {!isEdit && canApprove && onApproved && (
            <Button
              variant="primary"
              className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
              onClick={handleSendAndApprove}
              disabled={isPending}
              isLoading={isApproving}
              loadingText="Approving…"
            >
              Send &amp; Approve
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <SectionTitle>Requester</SectionTitle>

        <p className="text-sm text-gray-900">
          {requester ? [requester.name, requester.department].filter(Boolean).join(' - ') : '…'}
        </p>

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
          <>
            <div className="grid grid-cols-2 gap-4 items-start">
              <SearchSelect
                label="Destination (optional)"
                placeholder="Search for a location..."
                options={placeOptions}
                value={values.destination}
                onChange={(v) => {
                  set('destination', v);
                  setPlaceQuery('');
                }}
                onQueryChange={setPlaceQuery}
              />

              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <label className="text-sm font-bold text-gray-900">Purpose (optional)</label>
                <input
                  type="text"
                  placeholder="What is the trip for?"
                  value={values.tripPurpose}
                  onChange={(e) => set('tripPurpose', e.target.value)}
                  maxLength={500}
                  className={inputClass()}
                />
              </div>
            </div>
          </>
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
              label={appointment ? 'Add more destinations (optional)' : 'Destination'}
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

        <div className="grid grid-cols-3 gap-4">
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
            <label className="text-sm font-bold text-gray-900">Estimated Return (optional)</label>
            <input
              type="time"
              value={values.returnTime}
              onChange={(e) => set('returnTime', e.target.value)}
              className={inputClass(errors.returnTime)}
            />
            {errors.returnTime && <p className="text-xs text-red-500">{errors.returnTime}</p>}
          </div>
        </div>

        <SectionTitle>Vehicle, driver and passengers</SectionTitle>

        <div className="grid grid-cols-5 items-end gap-4">
          <div className={cn('min-w-0', canDriveSelf ? 'col-span-3' : 'col-span-5')}>
            <SearchSelect
              label="Vehicle"
              placeholder={options ? 'Select a vehicle' : 'Loading vehicles…'}
              options={vehicleOptions}
              value={pickedVehicle}
              onChange={(v) => set('vehicleAssetId', v)}
              error={errors.vehicle}
            />
          </div>
          {canDriveSelf && (
            <div className="col-span-2 py-3">
              <ToggleRow
                label="I will drive myself"
                enabled={selfDriven}
                onChange={(enabled) => {
                  set('selfDriven', enabled);
                  if (enabled) set('driverEmployeeId', '');
                }}
              />
            </div>
          )}
        </div>
        {canDriveSelf && licence?.status === 'EXPIRING' && licence.daysLeft !== null && (
          <p className="text-xs text-amber-600 -mt-2">
            Your driver&apos;s licence expires in {licence.daysLeft} day
            {licence.daysLeft === 1 ? '' : 's'}. Update it once renewed to keep driving yourself.
          </p>
        )}
        {options && !canDriveSelf && licence?.hasEmployeeRecord && (
          <p className="text-xs text-gray-400 -mt-2">
            Driving yourself needs an unexpired driver&apos;s licence with its image on file. Add it
            under My Documents.
          </p>
        )}
        {!windowValid && (
          <p className="text-xs text-gray-400 -mt-2">
            Set the travel date and departure time to see which vehicles and drivers are free.
          </p>
        )}
        {vehicleLost && (
          <p className="text-xs text-amber-600 -mt-2">
            That vehicle isn&apos;t free for this date and time, so it won&apos;t be requested.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 items-start">
          {!selfDriven && (
            <SearchSelect
              label="Driver"
              placeholder={options ? 'Select a driver' : 'Loading drivers…'}
              options={driverOptions}
              value={pickedDriver}
              onChange={(v) => set('driverEmployeeId', v)}
              error={errors.driver}
            />
          )}
          <div className={selfDriven ? 'col-span-2' : undefined}>
            <MultiSelect
              label="Travelling With (optional)"
              placeholder="Select colleagues"
              options={passengerOptions}
              value={values.passengerIds}
              onChange={(v) => set('passengerIds', v)}
              hideChips
            />
          </div>
        </div>
        {!selfDriven && driverLost && (
          <p className="text-xs text-amber-600 -mt-2">
            That driver isn&apos;t free for this date and time, so they won&apos;t be requested.
          </p>
        )}

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

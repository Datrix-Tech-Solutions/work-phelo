import { api } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
import type { TransportRequest, TransportTrendPoint } from '@/types/marketing';
import {
  changeText,
  fetchAll,
  monthBuckets,
  num,
  percent,
  rangeText,
  titleCase,
  type ReportDefinition,
} from './types';

const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'ON_ROUTE', 'COMPLETED', 'REJECTED', 'CANCELLED'];

/** The request list cannot be filtered by date, so the travel day is checked here. */
async function requestsBetween(from: string, to: string, status?: string) {
  const all = await fetchAll<TransportRequest>('/marketing/requests', {
    status: status || undefined,
  });
  return all.filter((r) => r.travelDate >= from && r.travelDate <= to);
}

const driverName = (r: TransportRequest) =>
  r.allocation?.driver.selfDriven
    ? `${r.requester.name} (self-driven)`
    : (r.allocation?.driver.name ?? '—');
const vehicleName = (r: TransportRequest) => r.allocation?.vehicle.name ?? '—';

export const transportRequests: ReportDefinition = {
  key: 'transport-requests',
  section: 'transport',
  title: 'Transport Requests',
  description: 'Every request in a period with its trip, vehicle, driver and outcome.',
  filters: [
    { kind: 'dateRange', label: 'Travel date' },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      options: REQUEST_STATUSES.map((s) => ({ value: s, label: titleCase(s) })),
    },
  ],
  async run(values) {
    const requests = await requestsBetween(values.from, values.to, values.status);
    const count = (status: string) => requests.filter((r) => r.status === status).length;
    const distance = requests.reduce((s, r) => s + num(r.completion?.distance), 0);
    const completed = count('COMPLETED');
    const closed = count('CANCELLED') + count('REJECTED');

    const byDepartment = new Map<string, { total: number; completed: number }>();
    for (const r of requests) {
      const key = r.requester.department ?? 'No department';
      const row = byDepartment.get(key) ?? { total: 0, completed: 0 };
      row.total += 1;
      if (r.status === 'COMPLETED') row.completed += 1;
      byDepartment.set(key, row);
    }

    return {
      subtitle: [
        `Travel ${rangeText(values)}`,
        ...(values.status ? [`Status: ${titleCase(values.status)}`] : []),
      ],
      stats: [
        { label: 'Requests', value: String(requests.length) },
        { label: 'Trips completed', value: String(completed) },
        { label: 'Cancelled or rejected', value: String(closed) },
        { label: 'Distance covered', value: `${distance.toLocaleString()} km` },
      ],
      tables: [
        {
          title: 'Requests',
          columns: [
            { label: 'Travel date' },
            { label: 'Departs' },
            { label: 'Requester' },
            { label: 'Department' },
            { label: 'Destination' },
            { label: 'Purpose' },
            { label: 'Vehicle' },
            { label: 'Driver' },
            { label: 'Status' },
            { label: 'Distance (km)', align: 'right' },
          ],
          rows: requests.map((r) => [
            formatDate(r.travelDate),
            r.departureTime,
            r.requester.name,
            r.requester.department ?? '—',
            r.destination,
            titleCase(r.purpose),
            vehicleName(r),
            driverName(r),
            titleCase(r.status),
            r.completion?.distance == null ? '—' : String(r.completion.distance),
          ]),
          csvRows: requests.map((r) => [
            r.travelDate,
            r.departureTime,
            r.requester.name,
            r.requester.department ?? '',
            r.destination,
            titleCase(r.purpose),
            vehicleName(r),
            driverName(r),
            titleCase(r.status),
            r.completion?.distance ?? '',
          ]),
        },
        {
          title: 'By department',
          columns: [
            { label: 'Department' },
            { label: 'Requests', align: 'right' },
            { label: 'Completed', align: 'right' },
            { label: 'Completion rate', align: 'right' },
          ],
          rows: [...byDepartment.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([name, d]) => [
              name,
              String(d.total),
              String(d.completed),
              percent(d.completed, d.total),
            ]),
        },
      ],
    };
  },
};

interface Usage {
  trips: number;
  distance: number;
  recorded: number;
  onTime: number;
}

function addUsage(map: Map<string, Usage>, key: string, r: TransportRequest) {
  const row = map.get(key) ?? { trips: 0, distance: 0, recorded: 0, onTime: 0 };
  row.trips += 1;
  row.distance += num(r.completion?.distance);
  const late = r.completion?.minutesLate;
  if (late != null) {
    row.recorded += 1;
    if (late <= 0) row.onTime += 1;
  }
  map.set(key, row);
}

export const vehicleDriverUsage: ReportDefinition = {
  key: 'vehicle-driver-usage',
  section: 'transport',
  title: 'Vehicle & Driver Usage',
  description: 'Completed trips, distance and punctuality for each vehicle and each driver.',
  filters: [{ kind: 'dateRange', label: 'Travel date' }],
  async run(values) {
    const trips = (await requestsBetween(values.from, values.to, 'COMPLETED')).filter(
      (r) => r.allocation,
    );
    const vehicles = new Map<string, Usage>();
    const drivers = new Map<string, Usage>();
    for (const r of trips) {
      addUsage(
        vehicles,
        `${r.allocation!.vehicle.name ?? 'Vehicle'}${r.allocation!.vehicle.assetNumber ? ` (${r.allocation!.vehicle.assetNumber})` : ''}`,
        r,
      );
      addUsage(drivers, driverName(r), r);
    }
    const distance = trips.reduce((s, r) => s + num(r.completion?.distance), 0);
    const recorded = trips.filter((r) => r.completion?.minutesLate != null);
    const onTime = recorded.filter((r) => (r.completion?.minutesLate ?? 0) <= 0).length;

    const table = (title: string, label: string, map: Map<string, Usage>) => {
      const entries = [...map.entries()].sort((a, b) => b[1].trips - a[1].trips);
      return {
        title,
        columns: [
          { label },
          { label: 'Trips', align: 'right' as const },
          { label: 'Distance (km)', align: 'right' as const },
          { label: 'On-time return', align: 'right' as const },
        ],
        rows: entries.map(([name, u]) => [
          name,
          String(u.trips),
          u.distance.toLocaleString(),
          percent(u.onTime, u.recorded),
        ]),
        csvRows: entries.map(([name, u]) => [
          name,
          u.trips,
          u.distance,
          percent(u.onTime, u.recorded),
        ]),
      };
    };

    return {
      subtitle: [`Completed trips, travel ${rangeText(values)}`],
      stats: [
        { label: 'Trips', value: String(trips.length) },
        { label: 'Distance covered', value: `${distance.toLocaleString()} km` },
        { label: 'Vehicles used', value: String(vehicles.size) },
        { label: 'On-time return', value: percent(onTime, recorded.length) },
      ],
      tables: [table('By vehicle', 'Vehicle', vehicles), table('By driver', 'Driver', drivers)],
    };
  },
};

export const transportTrend: ReportDefinition = {
  key: 'transport-trend',
  section: 'transport',
  title: 'Transport Trend',
  description: 'Requests raised and trips completed month by month, against the year before.',
  filters: [{ kind: 'year', label: 'Year' }],
  async run(values) {
    const year = Number(values.year);
    const months = monthBuckets(year);
    const ranges = (b: { fromDate: string; toDate: string }[]) =>
      b.map((x) => `${x.fromDate}:${x.toDate}`).join(',');
    const get = (b: typeof months) =>
      api.get<TransportTrendPoint[]>('/marketing/dashboard/transport/trend', {
        params: { ranges: ranges(b) },
      });
    const [now, before] = await Promise.all([get(months), get(monthBuckets(year - 1))]);
    const sum = (pts: TransportTrendPoint[], key: 'requested' | 'completed') =>
      pts.reduce((s, p) => s + p[key], 0);
    const rq = sum(now.data, 'requested');
    const cp = sum(now.data, 'completed');
    const prq = sum(before.data, 'requested');
    const pcp = sum(before.data, 'completed');

    return {
      subtitle: [`${year} against ${year - 1}`],
      stats: [
        { label: `Requests ${year}`, value: String(rq) },
        { label: 'Change on last year', value: changeText(rq, prq) },
        { label: `Trips completed ${year}`, value: String(cp) },
        { label: 'Completion rate', value: percent(cp, rq) },
      ],
      tables: [
        {
          title: 'Month by month',
          columns: [
            { label: 'Month' },
            { label: `Requested ${year}`, align: 'right' },
            { label: `Requested ${year - 1}`, align: 'right' },
            { label: 'Change', align: 'right' },
            { label: `Completed ${year}`, align: 'right' },
            { label: `Completed ${year - 1}`, align: 'right' },
            { label: 'Change', align: 'right' },
          ],
          rows: months.map((m, i) => {
            const a = now.data[i];
            const b = before.data[i];
            return [
              m.label,
              String(a?.requested ?? 0),
              String(b?.requested ?? 0),
              changeText(a?.requested ?? 0, b?.requested ?? 0),
              String(a?.completed ?? 0),
              String(b?.completed ?? 0),
              changeText(a?.completed ?? 0, b?.completed ?? 0),
            ];
          }),
          footer: [
            'Total',
            String(rq),
            String(prq),
            changeText(rq, prq),
            String(cp),
            String(pcp),
            changeText(cp, pcp),
          ],
        },
      ],
    };
  },
};

import { api } from '@/lib/api';
import { formatMoney } from '@/lib/formatMoney';
import { formatAppointmentTime } from '@/lib/appointments';
import { formatDate } from '@/lib/formatters';
import type {
  Appointment,
  ClientListItem,
  MarketingDashboardSummary,
  MarketingGrowthPoint,
  ProspectListItem,
  TargetReport,
} from '@/types/marketing';
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

const APPOINTMENT_STATUSES = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];

/** The span of equal length that ends the day before `from`, to compare a period against. */
function previousRange(from: string, to: string) {
  const day = 86_400_000;
  const start = new Date(from).getTime();
  const days = Math.round((new Date(to).getTime() - start) / day) + 1;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { prevFromDate: iso(start - days * day), prevToDate: iso(start - day) };
}

export const prospectListing: ReportDefinition = {
  key: 'prospect-report',
  section: 'crm',
  title: 'Prospect Report',
  description: 'Every prospect created in a period, with its rep, products, stage and values.',
  // The server already limits the list to the prospects the caller may see.
  open: true,
  filters: [
    { kind: 'dateRange', label: 'Created' },
    { kind: 'rep', key: 'rep', label: 'Sales representative' },
    { kind: 'stage', key: 'stage', label: 'Sales stage' },
    { kind: 'setting', key: 'product', label: 'Product or service', slug: 'products' },
    { kind: 'setting', key: 'source', label: 'Source type', slug: 'source-types' },
    { kind: 'setting', key: 'business', label: 'Business type', slug: 'business-types' },
  ],
  async run(values) {
    const prospects = await fetchAll<ProspectListItem>('/marketing/prospects', {
      createdFrom: values.from,
      createdTo: values.to,
      assignedUserId: values.rep || undefined,
      pipelineStageId: values.stage || undefined,
      productId: values.product || undefined,
      sourceTypeId: values.source || undefined,
      businessTypeId: values.business || undefined,
    });

    const expected = prospects.reduce((sum, p) => sum + num(p.expectedValue), 0);
    const achieved = prospects.reduce((sum, p) => sum + num(p.achievedValue), 0);
    const productNames = (p: ProspectListItem) => p.products.map((x) => x.name).join(', ');

    return {
      subtitle: [`Created ${rangeText(values)}`],
      stats: [
        { label: 'Prospects', value: String(prospects.length) },
        { label: 'Expected value', value: formatMoney(expected) },
        { label: 'Achieved value', value: formatMoney(achieved) },
        {
          label: 'Average progress',
          value: prospects.length
            ? `${Math.round(prospects.reduce((s, p) => s + p.progress, 0) / prospects.length)}%`
            : '—',
        },
      ],
      tables: [
        {
          title: 'Prospects',
          columns: [
            { label: 'Company' },
            { label: 'Sales representative' },
            { label: 'Product or service' },
            { label: 'Business type' },
            { label: 'Source type' },
            { label: 'Sales stage' },
            { label: 'Expected value', align: 'right' },
            { label: 'Achieved value', align: 'right' },
            { label: 'Last interaction' },
            { label: 'Expected close' },
            { label: 'Created' },
          ],
          rows: prospects.map((p) => [
            p.companyName,
            p.assignedUserName ?? '—',
            productNames(p) || '—',
            p.businessType?.name ?? '—',
            p.sourceType?.name ?? '—',
            p.salesStage.name,
            formatMoney(p.expectedValue),
            formatMoney(p.achievedValue),
            p.lastInteractionDate ? formatDate(p.lastInteractionDate) : '—',
            p.expectedCloseDate ? formatDate(p.expectedCloseDate) : '—',
            formatDate(p.createdAt),
          ]),
          csvRows: prospects.map((p) => [
            p.companyName,
            p.assignedUserName ?? '',
            productNames(p),
            p.businessType?.name ?? '',
            p.sourceType?.name ?? '',
            p.salesStage.name,
            num(p.expectedValue),
            num(p.achievedValue),
            p.lastInteractionDate?.slice(0, 10) ?? '',
            p.expectedCloseDate?.slice(0, 10) ?? '',
            p.createdAt.slice(0, 10),
          ]),
          footer: prospects.length
            ? [
                'Total',
                '',
                '',
                '',
                '',
                '',
                formatMoney(expected),
                formatMoney(achieved),
                '',
                '',
                '',
              ]
            : undefined,
        },
      ],
    };
  },
};

export const clientReport: ReportDefinition = {
  key: 'client-report',
  section: 'crm',
  title: 'Client Report',
  description: 'Every client signed in a period, with its rep, products, billing and revenue.',
  // The server already limits the list to the clients the caller may see.
  open: true,
  filters: [
    { kind: 'dateRange', label: 'Created' },
    { kind: 'rep', key: 'rep', label: 'Sales representative' },
    { kind: 'setting', key: 'product', label: 'Product or service', slug: 'products' },
    { kind: 'setting', key: 'source', label: 'Source type', slug: 'source-types' },
    { kind: 'setting', key: 'business', label: 'Business type', slug: 'business-types' },
  ],
  async run(values) {
    const clients = await fetchAll<ClientListItem>('/marketing/clients', {
      createdFrom: values.from,
      createdTo: values.to,
      assignedUserId: values.rep || undefined,
      productId: values.product || undefined,
      sourceTypeId: values.source || undefined,
      businessTypeId: values.business || undefined,
    });

    const expected = clients.reduce((sum, c) => sum + num(c.expectedValue), 0);
    const achieved = clients.reduce((sum, c) => sum + num(c.achievedRevenue), 0);
    const billable = clients.filter((c) => c.isBillable).length;
    const productNames = (c: ClientListItem) => c.products.map((x) => x.name).join(', ');

    return {
      subtitle: [`Created ${rangeText(values)}`],
      stats: [
        { label: 'Clients', value: String(clients.length) },
        { label: 'Billable', value: String(billable) },
        { label: 'Expected value', value: formatMoney(expected) },
        { label: 'Revenue achieved', value: formatMoney(achieved) },
      ],
      tables: [
        {
          title: 'Clients',
          columns: [
            { label: 'Company' },
            { label: 'Sales representative' },
            { label: 'Product or service' },
            { label: 'Business type' },
            { label: 'Source type' },
            { label: 'Billable' },
            { label: 'Expected value', align: 'right' },
            { label: 'Revenue achieved', align: 'right' },
            { label: 'Last interaction' },
            { label: 'Created' },
          ],
          rows: clients.map((c) => [
            c.companyName,
            c.assignedUserName ?? '—',
            productNames(c) || '—',
            c.businessType?.name ?? '—',
            c.sourceType?.name ?? '—',
            c.isBillable ? 'Yes' : 'No',
            formatMoney(c.expectedValue),
            formatMoney(c.achievedRevenue),
            c.lastInteractionDate ? formatDate(c.lastInteractionDate) : '—',
            formatDate(c.createdAt),
          ]),
          csvRows: clients.map((c) => [
            c.companyName,
            c.assignedUserName ?? '',
            productNames(c),
            c.businessType?.name ?? '',
            c.sourceType?.name ?? '',
            c.isBillable ? 'Yes' : 'No',
            num(c.expectedValue),
            c.achievedRevenue == null ? '' : num(c.achievedRevenue),
            c.lastInteractionDate?.slice(0, 10) ?? '',
            c.createdAt.slice(0, 10),
          ]),
          footer: clients.length
            ? ['Total', '', '', '', '', '', formatMoney(expected), formatMoney(achieved), '', '']
            : undefined,
        },
      ],
    };
  },
};

export const appointmentsReport: ReportDefinition = {
  key: 'appointments',
  section: 'crm',
  title: 'Appointments',
  description: 'Appointments in a period, with who they are for and how they turned out.',
  filters: [
    { kind: 'dateRange', label: 'Appointment date' },
    { kind: 'marketer', key: 'marketer', label: 'Marketer' },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      options: APPOINTMENT_STATUSES.map((s) => ({ value: s, label: titleCase(s) })),
    },
  ],
  async run(values) {
    const res = await api.get<{ data: Appointment[] }>('/marketing/appointments', {
      params: {
        from: values.from,
        to: values.to,
        ...(values.status ? { status: values.status } : {}),
      },
    });
    const appointments = res.data.data;
    const count = (status: string) => appointments.filter((a) => a.status === status).length;
    const completed = count('COMPLETED');
    // Pending ones have not been decided yet, so they do not count against the rate.
    const decided = appointments.length - count('PENDING');

    return {
      subtitle: [
        `Appointments ${rangeText(values)}`,
        ...(values.status ? [`Status: ${titleCase(values.status)}`] : []),
      ],
      stats: [
        { label: 'Appointments', value: String(appointments.length) },
        { label: 'Completed', value: String(completed) },
        { label: 'Cancelled or rejected', value: String(count('CANCELLED') + count('REJECTED')) },
        { label: 'Completion rate', value: percent(completed, decided) },
      ],
      tables: [
        {
          title: 'Appointments',
          columns: [
            { label: 'Date' },
            { label: 'Time' },
            { label: 'Prospect' },
            { label: 'Stage' },
            { label: 'Marketer' },
            { label: 'Manager' },
            { label: 'Status' },
          ],
          rows: appointments.map((a) => [
            formatDate(a.date),
            formatAppointmentTime(a),
            a.prospectName,
            a.salesStage?.name ?? '—',
            a.marketerName,
            a.managerName ?? '—',
            titleCase(a.status),
          ]),
          csvRows: appointments.map((a) => [
            a.date,
            formatAppointmentTime(a),
            a.prospectName,
            a.salesStage?.name ?? '',
            a.marketerName,
            a.managerName ?? '',
            titleCase(a.status),
          ]),
        },
      ],
    };
  },
};

export const salesPerformance: ReportDefinition = {
  key: 'sales-performance',
  section: 'crm',
  title: 'Sales Performance',
  description:
    'Conversion and revenue for a period against the one before, for everyone or one rep.',
  filters: [
    { kind: 'dateRange', label: 'Period' },
    { kind: 'rep', key: 'rep', label: 'Sales representative' },
  ],
  async run(values) {
    const { prevFromDate, prevToDate } = previousRange(values.from, values.to);
    const summary = await api.get<MarketingDashboardSummary>('/marketing/dashboard/summary', {
      params: {
        fromDate: values.from,
        toDate: values.to,
        prevFromDate,
        prevToDate,
        ...(values.rep ? { userId: values.rep } : {}),
      },
    });
    const s = summary.data;
    const currency = s.currency;
    const { created, converted } = s.conversion;

    const comparison: [string, number, number, boolean][] = [
      ['New prospects', s.newProspects.current, s.newProspects.previous, false],
      ['Prospects converted', s.conversion.converted, s.conversion.previousConverted, false],
      ['Sales won', num(s.sales.won), num(s.sales.previousWon), true],
      ['Revenue achieved', num(s.achievedRevenue.current), num(s.achievedRevenue.previous), true],
    ];

    return {
      subtitle: [
        `${rangeText(values)}${currency ? ` · ${currency}` : ''}`,
        `Compared with ${rangeText({ from: prevFromDate, to: prevToDate })}`,
      ],
      stats: [
        { label: 'Prospects created', value: String(created) },
        { label: 'Converted', value: String(converted) },
        { label: 'Conversion rate', value: percent(converted, created) },
        {
          label: 'Revenue achieved',
          value: s.achievedRevenue.current == null ? '—' : formatMoney(s.achievedRevenue.current),
        },
      ],
      tables: [
        {
          title: 'This period against the previous',
          columns: [
            { label: 'Measure' },
            { label: 'This period', align: 'right' },
            { label: 'Previous', align: 'right' },
            { label: 'Change', align: 'right' },
          ],
          rows: comparison.map(([label, cur, prev, isMoney]) => [
            label,
            isMoney ? formatMoney(cur) : String(cur),
            isMoney ? formatMoney(prev) : String(prev),
            changeText(cur, prev),
          ]),
          csvRows: comparison.map(([label, cur, prev]) => [
            label,
            cur,
            prev,
            changeText(cur, prev),
          ]),
        },
      ],
    };
  },
};

export const growthTrend: ReportDefinition = {
  key: 'growth-trend',
  section: 'crm',
  title: 'Growth Trend',
  description: 'New prospects and new clients month by month, against the year before.',
  filters: [{ kind: 'year', label: 'Year' }],
  async run(values) {
    const year = Number(values.year);
    const months = monthBuckets(year);
    const prior = monthBuckets(year - 1);
    const ranges = (b: { fromDate: string; toDate: string }[]) =>
      b.map((x) => `${x.fromDate}:${x.toDate}`).join(',');
    const [now, before] = await Promise.all([
      api.get<MarketingGrowthPoint[]>('/marketing/dashboard/growth', {
        params: { ranges: ranges(months) },
      }),
      api.get<MarketingGrowthPoint[]>('/marketing/dashboard/growth', {
        params: { ranges: ranges(prior) },
      }),
    ]);
    const sum = (points: MarketingGrowthPoint[], key: 'newProspects' | 'newClients') =>
      points.reduce((s, p) => s + p[key], 0);
    const tp = sum(now.data, 'newProspects');
    const tc = sum(now.data, 'newClients');
    const pp = sum(before.data, 'newProspects');
    const pc = sum(before.data, 'newClients');

    return {
      subtitle: [`${year} against ${year - 1}`],
      stats: [
        { label: `Prospects ${year}`, value: String(tp) },
        { label: 'Prospects change on last year', value: changeText(tp, pp) },
        { label: `Clients ${year}`, value: String(tc) },
        { label: 'Clients change on last year', value: changeText(tc, pc) },
      ],
      tables: [
        {
          title: 'Month by month',
          columns: [
            { label: 'Month' },
            { label: `Prospects ${year}`, align: 'right' },
            { label: `Prospects ${year - 1}`, align: 'right' },
            { label: 'Change', align: 'right' },
            { label: `Clients ${year}`, align: 'right' },
            { label: `Clients ${year - 1}`, align: 'right' },
            { label: 'Change', align: 'right' },
          ],
          rows: months.map((m, i) => {
            const a = now.data[i];
            const b = before.data[i];
            return [
              m.label,
              String(a?.newProspects ?? 0),
              String(b?.newProspects ?? 0),
              changeText(a?.newProspects ?? 0, b?.newProspects ?? 0),
              String(a?.newClients ?? 0),
              String(b?.newClients ?? 0),
              changeText(a?.newClients ?? 0, b?.newClients ?? 0),
            ];
          }),
          footer: [
            'Total',
            String(tp),
            String(pp),
            changeText(tp, pp),
            String(tc),
            String(pc),
            changeText(tc, pc),
          ],
        },
      ],
    };
  },
};

export const targetAchievement: ReportDefinition = {
  key: 'target-achievement',
  section: 'crm',
  title: 'Target Achievement',
  description:
    'Each sales rep’s yearly target, revenue achieved, what remains and the pipeline to come.',
  // Reps see their own figures; the server decides how much more the caller may see.
  open: true,
  filters: [
    { kind: 'year', label: 'Year' },
    { kind: 'targetRep', key: 'rep', label: 'Sales representative' },
    { kind: 'branch', key: 'branch', label: 'Branch' },
    { kind: 'department', key: 'department', label: 'Department' },
  ],
  async run(values) {
    const res = await api.get<TargetReport>('/marketing/reports/targets', {
      params: {
        year: values.year,
        userId: values.rep || undefined,
        branchId: values.branch || undefined,
        departmentId: values.department || undefined,
      },
    });
    const { reps, totals, currency, canViewTeam, year } = res.data;
    const money = (v: string | null) => (v == null ? '—' : formatMoney(v));
    const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
    // A rep sees their own row; the totals row is what the team viewer reads first.
    const headline = totals ?? reps[0] ?? null;

    return {
      subtitle: [
        `${year}${currency ? ` · ${currency}` : ''}`,
        canViewTeam ? 'Team view' : 'Your own target',
      ],
      stats: [
        {
          label: canViewTeam ? 'Team target' : 'Yearly target',
          value: money(headline?.target ?? null),
        },
        { label: 'Achieved', value: money(headline?.achieved ?? null) },
        { label: '% of target achieved', value: pct(headline?.percent ?? null) },
        { label: 'Expected pipeline', value: money(headline?.expected ?? null) },
      ],
      tables: [
        {
          title: 'Target achievement',
          description:
            'Targets whose period overlaps the year. Pipeline is deals not yet won that are expected to close in it.',
          columns: [
            { label: 'Sales representative' },
            { label: 'Branch' },
            { label: 'Department' },
            { label: 'Yearly target', align: 'right' },
            { label: 'Achieved', align: 'right' },
            { label: 'Remaining', align: 'right' },
            { label: '% achieved', align: 'right' },
            { label: 'Expected pipeline', align: 'right' },
          ],
          rows: reps.map((r) => [
            r.name,
            r.branch ?? '—',
            r.department ?? '—',
            money(r.target),
            money(r.achieved),
            money(r.remaining),
            pct(r.percent),
            money(r.expected),
          ]),
          csvRows: reps.map((r) => [
            r.name,
            r.branch ?? '',
            r.department ?? '',
            num(r.target),
            r.achieved == null ? '' : num(r.achieved),
            r.remaining == null ? '' : num(r.remaining),
            r.percent ?? '',
            num(r.expected),
          ]),
          footer: totals
            ? [
                'Team total',
                '',
                '',
                money(totals.target),
                money(totals.achieved),
                money(totals.remaining),
                pct(totals.percent),
                money(totals.expected),
              ]
            : undefined,
        },
      ],
    };
  },
};

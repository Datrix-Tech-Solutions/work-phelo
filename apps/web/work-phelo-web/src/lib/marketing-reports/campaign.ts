import { formatDate } from '@/lib/formatters';
import type { Campaign } from '@/types/marketing';
import {
  fetchAll,
  monthBuckets,
  percent,
  rangeText,
  titleCase,
  type ReportDefinition,
} from './types';

const CAMPAIGN_STATUSES = [
  'DRAFT',
  'PENDING_DISPATCH',
  'SCHEDULED',
  'SENDING',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
];

const totals = (campaigns: Campaign[]) => ({
  recipients: campaigns.reduce((s, c) => s + c.recipients.total, 0),
  delivered: campaigns.reduce((s, c) => s + c.recipients.delivered, 0),
  failed: campaigns.reduce((s, c) => s + c.recipients.failed, 0),
  credits: campaigns.reduce((s, c) => s + c.consumedCredits, 0),
});

export const campaignPerformance: ReportDefinition = {
  key: 'campaign-performance',
  section: 'campaign',
  title: 'Campaign Performance',
  description: 'Every campaign created in a period, with how its messages were delivered.',
  filters: [
    { kind: 'dateRange', label: 'Created' },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      options: CAMPAIGN_STATUSES.map((s) => ({ value: s, label: titleCase(s) })),
    },
  ],
  async run(values) {
    const all = await fetchAll<Campaign>('/marketing/campaigns', {
      status: values.status || undefined,
    });
    const campaigns = all.filter((c) => {
      const day = c.createdAt.slice(0, 10);
      return day >= values.from && day <= values.to;
    });
    const t = totals(campaigns);

    const byStatus = new Map<string, Campaign[]>();
    for (const c of campaigns) byStatus.set(c.status, [...(byStatus.get(c.status) ?? []), c]);

    return {
      subtitle: [
        `Created ${rangeText(values)}`,
        ...(values.status ? [`Status: ${titleCase(values.status)}`] : []),
      ],
      stats: [
        { label: 'Campaigns', value: String(campaigns.length) },
        { label: 'Recipients', value: String(t.recipients) },
        { label: 'Delivery rate', value: percent(t.delivered, t.recipients) },
        { label: 'Credits used', value: String(t.credits) },
      ],
      tables: [
        {
          title: 'Campaigns',
          columns: [
            { label: 'Campaign' },
            { label: 'Channels' },
            { label: 'Status' },
            { label: 'Created' },
            { label: 'Sent on' },
            { label: 'Recipients', align: 'right' },
            { label: 'Delivered', align: 'right' },
            { label: 'Failed', align: 'right' },
            { label: 'Delivery rate', align: 'right' },
            { label: 'Credits used', align: 'right' },
          ],
          rows: campaigns.map((c) => [
            c.name,
            c.channels.join(', '),
            titleCase(c.status),
            formatDate(c.createdAt),
            c.dispatchedAt ? formatDate(c.dispatchedAt) : '—',
            String(c.recipients.total),
            String(c.recipients.delivered),
            String(c.recipients.failed),
            percent(c.recipients.delivered, c.recipients.total),
            String(c.consumedCredits),
          ]),
          csvRows: campaigns.map((c) => [
            c.name,
            c.channels.join(', '),
            titleCase(c.status),
            c.createdAt.slice(0, 10),
            c.dispatchedAt?.slice(0, 10) ?? '',
            c.recipients.total,
            c.recipients.delivered,
            c.recipients.failed,
            percent(c.recipients.delivered, c.recipients.total),
            c.consumedCredits,
          ]),
          footer: campaigns.length
            ? [
                'Total',
                '',
                '',
                '',
                '',
                String(t.recipients),
                String(t.delivered),
                String(t.failed),
                percent(t.delivered, t.recipients),
                String(t.credits),
              ]
            : undefined,
        },
        {
          title: 'By status',
          columns: [
            { label: 'Status' },
            { label: 'Campaigns', align: 'right' },
            { label: 'Recipients', align: 'right' },
            { label: 'Delivered', align: 'right' },
            { label: 'Delivery rate', align: 'right' },
          ],
          rows: [...byStatus.entries()].map(([status, list]) => {
            const s = totals(list);
            return [
              titleCase(status),
              String(list.length),
              String(s.recipients),
              String(s.delivered),
              percent(s.delivered, s.recipients),
            ];
          }),
        },
      ],
    };
  },
};

export const campaignTrend: ReportDefinition = {
  key: 'campaign-trend',
  section: 'campaign',
  title: 'Campaign Trend',
  description: 'Campaigns sent and their delivery month by month across a year.',
  filters: [{ kind: 'year', label: 'Year' }],
  async run(values) {
    const year = Number(values.year);
    const all = await fetchAll<Campaign>('/marketing/campaigns');
    // A campaign counts in the month it went out; one that never went out counts in the month it was made.
    const monthOf = (c: Campaign) => (c.dispatchedAt ?? c.createdAt).slice(0, 7);
    const months = monthBuckets(year).map((m) => {
      const key = m.fromDate.slice(0, 7);
      const list = all.filter((c) => monthOf(c) === key);
      return { label: m.label, list, ...totals(list) };
    });
    const sum = totals(months.flatMap((m) => m.list));
    const count = months.reduce((s, m) => s + m.list.length, 0);

    return {
      subtitle: [`${year}`],
      stats: [
        { label: 'Campaigns', value: String(count) },
        { label: 'Recipients', value: String(sum.recipients) },
        { label: 'Delivery rate', value: percent(sum.delivered, sum.recipients) },
        { label: 'Credits used', value: String(sum.credits) },
      ],
      tables: [
        {
          title: 'Month by month',
          columns: [
            { label: 'Month' },
            { label: 'Campaigns', align: 'right' },
            { label: 'Recipients', align: 'right' },
            { label: 'Delivered', align: 'right' },
            { label: 'Failed', align: 'right' },
            { label: 'Delivery rate', align: 'right' },
            { label: 'Credits used', align: 'right' },
          ],
          rows: months.map((m) => [
            m.label,
            String(m.list.length),
            String(m.recipients),
            String(m.delivered),
            String(m.failed),
            percent(m.delivered, m.recipients),
            String(m.credits),
          ]),
          footer: [
            'Total',
            String(count),
            String(sum.recipients),
            String(sum.delivered),
            String(sum.failed),
            percent(sum.delivered, sum.recipients),
            String(sum.credits),
          ],
        },
      ],
    };
  },
};

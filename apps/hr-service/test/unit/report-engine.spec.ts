import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getReportDataset, ReportRow } from '../../src/reports/report-catalog';
import {
  COUNT_FIELD,
  ChartResult,
  ReportBlock,
  TableResult,
  dateBucket,
  describeCatalog,
  runBlock,
  validateBlock,
} from '../../src/reports/report-engine';
import { REPORT_DATASETS } from '../../src/reports/report-catalog';

const allowAll = () => true;
const allowNothing = () => false;
const employees = getReportDataset('employees')!;
const leave = getReportDataset('leave')!;

const staff: ReportRow[] = [
  {
    name: 'Ama',
    department: 'Finance',
    gender: 'Female',
    hireDate: new Date('2025-01-15'),
    basicSalary: 3000,
  },
  {
    name: 'Kofi',
    department: 'Finance',
    gender: 'Male',
    hireDate: new Date('2025-01-20'),
    basicSalary: 5000,
  },
  {
    name: 'Esi',
    department: 'Sales',
    gender: 'Female',
    hireDate: new Date('2025-03-02'),
    basicSalary: 4000,
  },
  {
    name: 'Yaw',
    department: 'Sales',
    gender: 'Male',
    hireDate: new Date('2025-03-09'),
    basicSalary: null,
  },
  {
    name: 'Abena',
    department: 'Sales',
    gender: 'Female',
    hireDate: null,
    basicSalary: 2000,
  },
];

const chart = (overrides: Partial<ReportBlock>): ReportBlock => ({
  dataset: 'employees',
  chartType: 'BAR',
  groupBy: { field: 'department' },
  measures: [{ field: COUNT_FIELD, aggregation: 'count' }],
  ...overrides,
});

describe('validateBlock', () => {
  it('accepts a table with valid columns', () => {
    expect(
      validateBlock(
        { dataset: 'employees', columns: ['name', 'department'] },
        'TABLE',
        allowAll,
      ),
    ).toBe(employees);
  });

  it('rejects an unknown dataset and unknown fields', () => {
    expect(() =>
      validateBlock({ dataset: 'nope', columns: ['x'] }, 'TABLE', allowAll),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlock(
        { dataset: 'employees', columns: ['password'] },
        'TABLE',
        allowAll,
      ),
    ).toThrow(/Unknown field/);
  });

  it('requires at least one column and a sort that is one of the columns', () => {
    expect(() =>
      validateBlock({ dataset: 'employees', columns: [] }, 'TABLE', allowAll),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlock(
        {
          dataset: 'employees',
          columns: ['name'],
          sort: { field: 'department', direction: 'asc' },
        },
        'TABLE',
        allowAll,
      ),
    ).toThrow(/Sort by one of the columns/);
  });

  it('keeps tables and charts apart', () => {
    expect(() => validateBlock(chart({}), 'TABLE', allowAll)).toThrow(
      /only hold table blocks/,
    );
    expect(() =>
      validateBlock(
        { dataset: 'employees', columns: ['name'] },
        'CHART',
        allowAll,
      ),
    ).toThrow(BadRequestException);
  });

  it('needs a date group-by for line and area charts', () => {
    expect(() =>
      validateBlock(chart({ chartType: 'LINE' }), 'CHART', allowAll),
    ).toThrow(/need a date/);
    expect(() =>
      validateBlock(
        chart({
          chartType: 'LINE',
          groupBy: { field: 'hireDate', granularity: 'month' },
        }),
        'CHART',
        allowAll,
      ),
    ).not.toThrow();
  });

  it('needs a granularity for dates and none for categories', () => {
    expect(() =>
      validateBlock(
        chart({ groupBy: { field: 'hireDate' } }),
        'CHART',
        allowAll,
      ),
    ).toThrow(/Pick how to group/);
    expect(() =>
      validateBlock(
        chart({ groupBy: { field: 'department', granularity: 'month' } }),
        'CHART',
        allowAll,
      ),
    ).toThrow(/no granularity/);
  });

  it('limits measures: two at most, one for pie, numbers only', () => {
    const three = [
      { field: COUNT_FIELD, aggregation: 'count' as const },
      { field: 'basicSalary', aggregation: 'sum' as const },
      { field: 'basicSalary', aggregation: 'avg' as const },
    ];
    expect(() =>
      validateBlock(chart({ measures: three }), 'CHART', allowAll),
    ).toThrow(/at most 2/);
    expect(() =>
      validateBlock(
        chart({
          chartType: 'PIE',
          measures: [
            { field: COUNT_FIELD, aggregation: 'count' },
            { field: 'basicSalary', aggregation: 'sum' },
          ],
        }),
        'CHART',
        allowAll,
      ),
    ).toThrow(/exactly one measure/);
    expect(() =>
      validateBlock(
        chart({ measures: [{ field: 'department', aggregation: 'sum' }] }),
        'CHART',
        allowAll,
      ),
    ).toThrow(/not a number/);
  });

  it('only allows scatter on two number fields', () => {
    expect(() =>
      validateBlock(
        {
          dataset: 'employees',
          chartType: 'SCATTER',
          scatter: { x: 'basicSalary', y: 'department' },
        },
        'CHART',
        allowAll,
      ),
    ).toThrow(/two number fields/);
    expect(() =>
      validateBlock(
        { dataset: 'employees', chartType: 'SCATTER' },
        'CHART',
        allowAll,
      ),
    ).toThrow(/X and a Y/);
  });

  it('blocks datasets and fields the user has no permission for', () => {
    expect(() =>
      validateBlock(
        { dataset: 'payroll', columns: ['employee'] },
        'TABLE',
        allowNothing,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      validateBlock(
        { dataset: 'employees', columns: ['name', 'basicSalary'] },
        'TABLE',
        allowNothing,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      validateBlock(
        { dataset: 'employees', columns: ['name'] },
        'TABLE',
        allowNothing,
      ),
    ).not.toThrow();
  });
});

describe('describeCatalog', () => {
  it('hides datasets and fields the user may not use', () => {
    const catalog = describeCatalog(REPORT_DATASETS, allowNothing);
    expect(catalog.map((d) => d.key)).not.toContain('payroll');
    const emp = catalog.find((d) => d.key === 'employees')!;
    expect(emp.fields.map((f) => f.key)).not.toContain('basicSalary');
    expect(
      describeCatalog(REPORT_DATASETS, allowAll).map((d) => d.key),
    ).toContain('payroll');
  });
});

describe('dateBucket', () => {
  it('labels so that plain string order is date order', () => {
    const d = new Date('2025-11-05T10:00:00Z');
    expect(dateBucket(d, 'day')).toBe('2025-11-05');
    expect(dateBucket(d, 'month')).toBe('2025-11');
    expect(dateBucket(d, 'quarter')).toBe('2025-Q4');
    expect(dateBucket(d, 'year')).toBe('2025');
  });
});

describe('runBlock charts', () => {
  const run = (block: ReportBlock, rows = staff, ds = employees) =>
    runBlock(ds, rows, block, { truncated: false }) as ChartResult;

  it('counts by category, biggest group first', () => {
    const result = run(chart({}));
    expect(result.rows).toEqual([
      { group: 'Sales', values: [3] },
      { group: 'Finance', values: [2] },
    ]);
  });

  it('compares two measures per group and skips nulls in sums and averages', () => {
    const result = run(
      chart({
        measures: [
          { field: 'basicSalary', aggregation: 'sum' },
          { field: 'basicSalary', aggregation: 'avg' },
        ],
      }),
    );
    expect(result.measures.map((m) => m.label)).toEqual([
      'Total basic salary',
      'Average basic salary',
    ]);
    const sales = result.rows.find((r) => r.group === 'Sales')!;
    expect(sales.values).toEqual([6000, 3000]); // Yaw's null salary is left out of both
  });

  it('returns null, not zero, for a group with no figures', () => {
    const result = run(
      chart({ measures: [{ field: 'basicSalary', aggregation: 'sum' }] }),
      [{ department: 'Legal', basicSalary: null }],
    );
    expect(result.rows[0].values).toEqual([null]);
  });

  it('groups dates in order and leaves out records with no date', () => {
    const result = run(
      chart({
        chartType: 'LINE',
        groupBy: { field: 'hireDate', granularity: 'month' },
      }),
    );
    expect(result.rows).toEqual([
      { group: '2025-01', values: [2] },
      { group: '2025-03', values: [2] },
    ]);
  });

  it('applies filters before grouping', () => {
    const result = run(
      chart({ filters: [{ field: 'gender', values: ['Female'] }] }),
    );
    expect(result.rows).toEqual([
      { group: 'Sales', values: [2] },
      { group: 'Finance', values: [1] },
    ]);
  });

  it('builds scatter points from rows that have both numbers', () => {
    const result = run({
      dataset: 'employees',
      chartType: 'SCATTER',
      scatter: { x: 'basicSalary', y: 'basicSalary', label: 'name' },
    });
    expect(result.points).toHaveLength(4);
    expect(result.points?.[0]).toEqual({ label: 'Ama', x: 3000, y: 3000 });
  });

  it('works for another dataset', () => {
    const result = run(
      {
        dataset: 'leave',
        chartType: 'BAR_HORIZONTAL',
        groupBy: { field: 'leaveType' },
        measures: [{ field: 'totalDays', aggregation: 'sum' }],
      },
      [
        { leaveType: 'Annual', totalDays: 5 },
        { leaveType: 'Annual', totalDays: 3 },
        { leaveType: 'Sick', totalDays: 2 },
      ],
      leave,
    );
    expect(result.rows).toEqual([
      { group: 'Annual', values: [8] },
      { group: 'Sick', values: [2] },
    ]);
  });
});

describe('runBlock tables', () => {
  const table = (block: ReportBlock, options = {}) =>
    runBlock(employees, staff, block, {
      truncated: false,
      ...options,
    }) as TableResult;

  it('returns only the picked columns with dates as plain days', () => {
    const result = table({
      dataset: 'employees',
      columns: ['name', 'hireDate'],
    });
    expect(result.columns.map((c) => c.key)).toEqual(['name', 'hireDate']);
    expect(result.rows[0]).toEqual({ name: 'Ama', hireDate: '2025-01-15' });
    expect(result.total).toBe(5);
  });

  it('sorts, with empty cells last, and pages', () => {
    const result = table(
      {
        dataset: 'employees',
        columns: ['name', 'basicSalary'],
        sort: { field: 'basicSalary', direction: 'desc' },
      },
      { page: 1, pageSize: 2 },
    );
    expect(result.rows.map((r) => r.name)).toEqual(['Kofi', 'Esi']);
    expect(result.total).toBe(5);
    const last = table(
      {
        dataset: 'employees',
        columns: ['name', 'basicSalary'],
        sort: { field: 'basicSalary', direction: 'asc' },
      },
      { page: 3, pageSize: 2 },
    );
    expect(last.rows.map((r) => r.name)).toEqual(['Yaw']);
  });
});

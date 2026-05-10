import type { PayrollRunDetail, PayrollItem } from '@/types/hr';

export const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function payrollMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

function fmtNum(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function triggerCSV(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPayrollPDFFormat(
  detail: PayrollRunDetail,
  label: string,
  format: 'bank' | 'full' = 'full',
  companyName = '',
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let headerY = 16;
  if (companyName) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 14, headerY);
    headerY += 7;
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Payroll Report', 14, headerY);
  headerY += 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(label, 14, headerY);
  doc.setTextColor(0, 0, 0);

  const sum = (key: keyof (typeof detail.items)[0]) =>
    fmtNum(detail.items.reduce((s, i) => s + parseFloat((i[key] as string) || '0'), 0));

  const isFull = format === 'full';

  const head = isFull
    ? [
        [
          'Employee',
          'Employee Number',
          'Basic Salary',
          'Allowances',
          'Gross',
          'Emp. SSNIT',
          'PAYE',
          'Other Ded.',
          'Net Salary',
        ],
      ]
    : [['Employee', 'Employee Number', 'Bank Name', 'Bank Branch', 'Account Number', 'Net Salary']];

  const body = isFull
    ? detail.items.map((item) => [
        item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
        item.employee?.employeeNumber ?? '',
        fmtNum(item.basicSalary),
        fmtNum(item.totalAllowances),
        fmtNum(item.grossSalary),
        fmtNum(item.employeeSSNIT),
        fmtNum(item.payeTax),
        fmtNum(item.otherDeductions),
        fmtNum(item.netSalary),
      ])
    : detail.items.map((item) => [
        item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
        item.employee?.employeeNumber ?? '',
        item.employee?.bankName ?? '',
        item.employee?.bankBranch ?? '',
        item.employee?.bankAccountNumber ?? '',
        fmtNum(item.netSalary),
      ]);

  const foot = isFull
    ? [
        [
          'TOTAL',
          '',
          sum('basicSalary'),
          sum('totalAllowances'),
          sum('grossSalary'),
          sum('employeeSSNIT'),
          sum('payeTax'),
          sum('otherDeductions'),
          sum('netSalary'),
        ],
      ]
    : [['TOTAL', '', '', '', '', sum('netSalary')]];

  // numeric column indices (all columns except Employee and Employee #)
  const numericCols = isFull ? [2, 3, 4, 5, 6, 7, 8] : [5];
  const lastCol = isFull ? 8 : 5;

  const colStyles = Object.fromEntries(
    numericCols.map((i) => [
      i,
      {
        halign: 'right' as const,
        fontStyle: i === lastCol ? ('bold' as const) : ('normal' as const),
      },
    ]),
  );

  autoTable(doc, {
    startY: companyName ? 37 : 30,
    head,
    body,
    foot,
    showFoot: 'lastPage',
    headStyles: { fillColor: [13, 31, 68], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: {
      fillColor: [240, 242, 247],
      textColor: [13, 31, 68],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: colStyles,
    // force right-align on numeric footer cells (columnStyles halign can be overridden by footStyles)
    didParseCell: (data) => {
      if (data.section === 'foot' && numericCols.includes(data.column.index)) {
        data.cell.styles.halign = 'right';
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 14,
      doc.internal.pageSize.height - 8,
      { align: 'right' },
    );
  }

  doc.save(`payroll-${format}-${label}.pdf`);
}

export async function downloadPayslipPDF(
  item: PayrollItem,
  label: string,
  companyName = '',
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const margin = 20;

  // Header bar
  const headerH = companyName ? 34 : 28;
  doc.setFillColor(13, 31, 68);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Left: company name + PAYSLIP label
  if (companyName) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(companyName, margin, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 200, 240);
    doc.text('PAYSLIP', margin, 21);
  } else {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PAYSLIP', margin, 17);
  }

  // Right: employee name + period + paid date
  const rightY = companyName ? 12 : 17;
  if (item.employee) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${item.employee.firstName} ${item.employee.lastName}`, pageW - margin, rightY, {
      align: 'right',
    });
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 240);
  doc.text(label, pageW - margin, rightY + 6, { align: 'right' });
  if (item.payrollRun?.paidAt) {
    const paid = new Date(item.payrollRun.paidAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    doc.text(`Paid ${paid}`, pageW - margin, rightY + 12, { align: 'right' });
  }

  // Employee info (job title, employee #, bank)
  let y = headerH + 10;
  if (item.employee) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const sub = [item.employee.jobTitle, item.employee.employeeNumber]
      .filter(Boolean)
      .join('  ·  ');
    if (sub) {
      doc.text(sub, margin, y);
      y += 5;
    }
    if (item.employee.bankName) {
      doc.text(
        `Bank: ${item.employee.bankName}${item.employee.bankAccountNumber ? `  ·  ${item.employee.bankAccountNumber}` : ''}`,
        margin,
        y,
      );
      y += 5;
    }
  }
  y += 4;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setTextColor(0, 0, 0);

  // Earnings table — transport and other allowances as separate rows
  const earningsRows: string[][] = [['Basic Salary', fmtNum(item.basicSalary)]];
  const transportAmt = parseFloat(item.transportAmount);
  const otherAllowances = parseFloat(item.totalAllowances) - transportAmt;
  if (transportAmt > 0) earningsRows.push(['Transport Allowance', fmtNum(item.transportAmount)]);
  if (otherAllowances > 0) earningsRows.push(['Other Allowances', fmtNum(otherAllowances)]);
  if (parseFloat(item.overtimePay) > 0) earningsRows.push(['Overtime', fmtNum(item.overtimePay)]);
  if (parseFloat(item.bonus) > 0) earningsRows.push(['Bonus', fmtNum(item.bonus)]);
  if (parseFloat(item.thirteenthMonth) > 0)
    earningsRows.push(['13th Month', fmtNum(item.thirteenthMonth)]);

  autoTable(doc, {
    startY: y,
    head: [['Earnings', 'Amount (GHS)']],
    body: earningsRows,
    foot: [['Gross Salary', fmtNum(item.grossSalary)]],
    showFoot: 'lastPage',
    headStyles: { fillColor: [13, 31, 68], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    footStyles: {
      fillColor: [240, 242, 247],
      textColor: [13, 31, 68],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 1) data.cell.styles.halign = 'right';
    },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Deductions table
  const deductionRows: string[][] = [
    ['Employee SSNIT (5.5%)', fmtNum(item.employeeSSNIT)],
    ['PAYE Tax', fmtNum(item.payeTax)],
  ];
  if (parseFloat(item.tier3Employee) > 0)
    deductionRows.push(['Tier 3', fmtNum(item.tier3Employee)]);
  if (parseFloat(item.otherDeductions) > 0)
    deductionRows.push(['Other Deductions', fmtNum(item.otherDeductions)]);

  autoTable(doc, {
    startY: y,
    head: [['Deductions', 'Amount (GHS)']],
    body: deductionRows,
    foot: [['Total Deductions', fmtNum(item.totalDeductions)]],
    showFoot: 'lastPage',
    headStyles: { fillColor: [13, 31, 68], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    footStyles: {
      fillColor: [240, 242, 247],
      textColor: [13, 31, 68],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 1) data.cell.styles.halign = 'right';
    },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Net salary summary bar
  doc.setFillColor(13, 31, 68);
  doc.roundedRect(margin, y, pageW - margin * 2, 14, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('NET SALARY', margin + 6, y + 9);
  doc.text(`GHS ${fmtNum(item.netSalary)}`, pageW - margin - 6, y + 9, { align: 'right' });

  const name = item.employee ? `${item.employee.firstName}-${item.employee.lastName}` : 'payslip';
  doc.save(`payslip-${name}-${label}.pdf`);
}

export function downloadPayrollBankFormat(
  detail: PayrollRunDetail,
  label: string,
  companyName = '',
): void {
  const headers = [
    'Employee',
    'Employee Number',
    'Bank Name',
    'Bank Branch',
    'Account Number',
    'Net Salary',
  ];
  const rows = detail.items.map((item) => [
    item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    item.employee?.employeeNumber ?? '',
    item.employee?.bankName ?? '',
    item.employee?.bankBranch ?? '',
    item.employee?.bankAccountNumber ?? '',
    fmtNum(item.netSalary),
  ]);
  const meta = companyName ? [[companyName], [`Payroll Report — ${label}`], []] : [];
  triggerCSV(`payroll-bank-${label}.csv`, [...meta, headers, ...rows]);
}

export function downloadPayrollFullFormat(
  detail: PayrollRunDetail,
  label: string,
  companyName = '',
): void {
  const headers = [
    'Employee',
    'Employee Number',
    'Job Title',
    'Basic Salary',
    'Allowances',
    'Gross Salary',
    'Employee SSNIT',
    'Employer SSNIT',
    'PAYE',
    'Other Deductions',
    'Net Salary',
  ];
  const rows = detail.items.map((item) => [
    item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    item.employee?.employeeNumber ?? '',
    item.employee?.jobTitle ?? '',
    fmtNum(item.basicSalary),
    fmtNum(item.totalAllowances),
    fmtNum(item.grossSalary),
    fmtNum(item.employeeSSNIT),
    fmtNum(item.employerSSNIT),
    fmtNum(item.payeTax),
    fmtNum(item.otherDeductions),
    fmtNum(item.netSalary),
  ]);
  const meta = companyName ? [[companyName], [`Payroll Report — ${label}`], []] : [];
  triggerCSV(`payroll-full-${label}.csv`, [...meta, headers, ...rows]);
}

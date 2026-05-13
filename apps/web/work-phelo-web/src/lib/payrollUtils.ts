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

function payrollAllowanceRows(item: PayrollItem): Array<[string, number]> {
  if (item.allowanceItems?.length) {
    return item.allowanceItems
      .map((allowance) => [allowance.name, parseFloat(allowance.amount)] as [string, number])
      .filter(([, amount]) => amount > 0);
  }

  const rows: Array<[string, number]> = [];
  const transportAmount = parseFloat(item.transportAmount);
  const nonTransportAllowances = parseFloat(item.totalAllowances);
  if (transportAmount > 0) rows.push(['Transport Allowance', transportAmount]);
  if (nonTransportAllowances > 0) rows.push(['Allowances', nonTransportAllowances]);
  return rows;
}

function payrollDeductionRows(item: PayrollItem): Array<[string, number]> {
  if (item.deductionItems?.length) {
    return item.deductionItems
      .map((deduction) => [deduction.name, parseFloat(deduction.amount)] as [string, number])
      .filter(([, amount]) => amount > 0);
  }

  const otherDeductions = parseFloat(item.otherDeductions);
  return otherDeductions > 0 ? [['Deductions', otherDeductions]] : [];
}

function lineItemsSummary(rows: Array<[string, number]>, fallback: string | number): string {
  if (rows.length === 0) return fmtNum(fallback);
  return rows.map(([name, amount]) => `${name}: ${fmtNum(amount)}`).join('; ');
}

function sumLineItems(rows: Array<[string, number]>, fallback: string | number): number {
  if (rows.length > 0) return rows.reduce((sum, [, amount]) => sum + amount, 0);
  const value = typeof fallback === 'string' ? parseFloat(fallback) : fallback;
  return Number.isFinite(value) ? value : 0;
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
  const sumAllowances = () =>
    fmtNum(
      detail.items.reduce(
        (s, item) => s + sumLineItems(payrollAllowanceRows(item), parseFloat(item.totalAllowances)),
        0,
      ),
    );
  const sumDeductions = () =>
    fmtNum(
      detail.items.reduce(
        (s, item) => s + sumLineItems(payrollDeductionRows(item), parseFloat(item.otherDeductions)),
        0,
      ),
    );

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
          'Deductions',
          'Net Salary',
        ],
      ]
    : [['Employee', 'Employee Number', 'Bank Name', 'Bank Branch', 'Account Number', 'Net Salary']];

  const body = isFull
    ? detail.items.map((item) => [
        item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
        item.employee?.employeeNumber ?? '',
        fmtNum(item.basicSalary),
        lineItemsSummary(payrollAllowanceRows(item), item.totalAllowances),
        fmtNum(item.grossSalary),
        fmtNum(item.employeeSSNIT),
        fmtNum(item.payeTax),
        lineItemsSummary(payrollDeductionRows(item), item.otherDeductions),
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
          sumAllowances(),
          sum('grossSalary'),
          sum('employeeSSNIT'),
          sum('payeTax'),
          sumDeductions(),
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

export interface PayslipCompanyInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PayslipEmployeeInfo {
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  jobTitle?: string;
  department?: string;
  tinNumber?: string;
  ssnit?: string;
  branchName?: string;
  branchAddress?: string;
  branchCity?: string;
  branchRegion?: string;
  branchCountry?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
}

export interface PayslipYTD {
  grossEarnings: number;
  ssnitContribution: number;
  payeTax: number;
  netPay: number;
}

function numberToWords(n: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  if (n === 0) return 'Zero';

  function below1000(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    return (
      ones[Math.floor(num / 100)] +
      ' Hundred' +
      (num % 100 !== 0 ? ' and ' + below1000(num % 100) : '')
    );
  }

  let rem = Math.floor(n);
  let result = '';
  if (rem >= 1000000) {
    result += below1000(Math.floor(rem / 1000000)) + ' Million ';
    rem %= 1000000;
  }
  if (rem >= 1000) {
    result += below1000(Math.floor(rem / 1000)) + ' Thousand ';
    rem %= 1000;
  }
  if (rem > 0) {
    if (result) result += 'and ';
    result += below1000(rem);
  }
  return result.trim();
}

function amountInWords(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n) || n < 0) return '';
  const cedis = Math.floor(n);
  const pesewas = Math.round((n - cedis) * 100);
  let words = numberToWords(cedis) + ' Ghana Cedi' + (cedis !== 1 ? 's' : '');
  if (pesewas > 0) words += ' ' + numberToWords(pesewas) + ' Pesewa' + (pesewas !== 1 ? 's' : '');
  return words + ' Only';
}

function companyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 5);
}

function payslipNumber(companyName: string, itemId: string): string {
  const initials = companyInitials(companyName) || 'PS';
  const suffix = itemId.replace(/-/g, '').slice(-6).toUpperCase();
  return `${initials}-${suffix}`;
}

export async function downloadPayslipPDF(
  item: PayrollItem,
  label: string,
  company: PayslipCompanyInfo | string = '',
  employeeProfile?: PayslipEmployeeInfo,
  ytd?: PayslipYTD,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const companyInfo: PayslipCompanyInfo = typeof company === 'string' ? { name: company } : company;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const M = 14; // margin
  const mid = pageW / 2;
  const lastAutoTable = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Header ────────────────────────────────────────────────────────────────
  // Left: company name then branch location then contact
  let hy = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(13, 31, 68);
  doc.text(companyInfo.name || 'Company', M, hy);
  hy += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);

  // Branch address line: "123 High St, Accra, Greater Accra, Ghana"
  if (employeeProfile) {
    const { branchAddress, branchCity, branchRegion, branchCountry } = employeeProfile;
    const cityRegion = [branchCity, branchRegion].filter(Boolean).join(', ');
    const addressLine = [branchAddress, cityRegion, branchCountry].filter(Boolean).join(', ');
    if (addressLine) {
      doc.text(addressLine, M, hy);
      hy += 4;
    }
  }

  const contactLine = [companyInfo.phone, companyInfo.email].filter(Boolean).join('  |  ');
  if (contactLine) {
    doc.text(contactLine, M, hy);
    hy += 4;
  }

  // Right: PAYSLIP title + meta
  const payPeriod = label;
  const payDate = item.payrollRun?.paidAt
    ? new Date(item.payrollRun.paidAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : item.payrollRun
      ? new Date(item.payrollRun.year, item.payrollRun.month, 0).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';
  const psNo = payslipNumber(companyInfo.name, item.id);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(13, 31, 68);
  doc.text('PAYSLIP', pageW - M, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Pay Period: ${payPeriod}`, pageW - M, 23, { align: 'right' });
  doc.text(`Pay Date: ${payDate}`, pageW - M, 27, { align: 'right' });
  doc.text(`Payslip No: ${psNo}`, pageW - M, 31, { align: 'right' });

  // Divider
  const divY = Math.max(hy, 34) + 2;
  doc.setDrawColor(13, 31, 68);
  doc.setLineWidth(0.5);
  doc.line(M, divY, pageW - M, divY);
  doc.setLineWidth(0.2);

  // ── Employee info grid ────────────────────────────────────────────────────
  let y = divY + 6;
  // prefer the full profile passed in; fall back to the summary embedded in the item
  const emp: PayslipEmployeeInfo | undefined =
    employeeProfile ??
    (item.employee
      ? {
          firstName: item.employee.firstName,
          lastName: item.employee.lastName,
          employeeNumber: item.employee.employeeNumber,
          jobTitle: item.employee.jobTitle,
          department: item.employee.department ?? undefined,
          tinNumber: item.employee.tinNumber ?? undefined,
          ssnit: item.employee.ssnit ?? undefined,
          branchName: item.employee.branchName ?? undefined,
          bankName: item.employee.bankName ?? undefined,
          bankBranch: item.employee.bankBranch ?? undefined,
          bankAccountNumber: item.employee.bankAccountNumber ?? undefined,
        }
      : undefined);

  const labelStyle = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
  };
  const valueStyle = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
  };

  const infoRows: [string, string, string, string][] = [
    [
      'Employee Name:',
      emp ? `${emp.firstName} ${emp.lastName}` : '—',
      'Employee ID:',
      emp?.employeeNumber ?? '—',
    ],
    ['Role:', emp?.jobTitle ?? '—', 'Department:', emp?.department ?? '—'],
    ['TIN:', emp?.tinNumber ?? '—', 'SSNIT No:', emp?.ssnit ?? '—'],
    ['Bank:', emp?.bankName ?? '—', 'Account No:', emp?.bankAccountNumber ?? '—'],
  ];
  if (emp?.bankBranch) {
    infoRows.push(['Bank Branch:', emp.bankBranch, 'Location:', emp?.branchName ?? '—']);
  } else if (emp?.branchName) {
    infoRows.push(['Location:', emp.branchName, '', '']);
  }

  const colW = (pageW - M * 2) / 2;
  const labelW = 28;

  for (const [l1, v1, l2, v2] of infoRows) {
    labelStyle();
    doc.text(l1, M, y);
    valueStyle();
    doc.text(v1, M + labelW, y);
    if (l2) {
      labelStyle();
      doc.text(l2, mid, y);
      valueStyle();
      doc.text(v2, mid + labelW, y);
    }
    y += 5.5;
  }

  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, pageW - M, y);
  y += 5;

  // ── Side-by-side earnings / deductions ───────────────────────────────────
  const tableW = colW - 2;
  const earningsStartY = y;

  const earningsRows: string[][] = [['Basic Salary', fmtNum(item.basicSalary)]];
  payrollAllowanceRows(item).forEach(([name, amount]) => {
    earningsRows.push([name, fmtNum(amount)]);
  });
  if (parseFloat(item.overtimePay) > 0)
    earningsRows.push(['Overtime Pay', fmtNum(item.overtimePay)]);
  if (parseFloat(item.bonus) > 0) earningsRows.push(['Bonus / Incentive', fmtNum(item.bonus)]);
  if (parseFloat(item.thirteenthMonth) > 0)
    earningsRows.push(['13th Month', fmtNum(item.thirteenthMonth)]);

  const deductionRows: string[][] = [
    ['Employee SSNIT (5.5%)', fmtNum(item.employeeSSNIT)],
    ['Income Tax (PAYE)', fmtNum(item.payeTax)],
  ];
  if (parseFloat(item.tier3Employee) > 0)
    deductionRows.push(['Tier 3', fmtNum(item.tier3Employee)]);
  payrollDeductionRows(item).forEach(([name, amount]) => {
    deductionRows.push([name, fmtNum(amount)]);
  });

  const tableHeadStyles = {
    fillColor: [13, 31, 68] as [number, number, number],
    textColor: 255 as number,
    fontSize: 8,
    fontStyle: 'bold' as const,
  };
  const tableBodyStyles = { fontSize: 8 };
  const tableFootStyles = {
    fillColor: [235, 238, 245] as [number, number, number],
    textColor: [13, 31, 68] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 8,
  };

  // Earnings (left)
  autoTable(doc, {
    startY: earningsStartY,
    head: [['EARNINGS', 'Amount (GHS)']],
    body: earningsRows,
    foot: [['GROSS EARNINGS', fmtNum(item.grossSalary)]],
    showFoot: 'lastPage',
    headStyles: tableHeadStyles,
    bodyStyles: tableBodyStyles,
    footStyles: tableFootStyles,
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 1) data.cell.styles.halign = 'right';
    },
    margin: { left: M, right: M + tableW + 4 },
    tableWidth: tableW,
  });
  const earningsFinalY = lastAutoTable();

  // Deductions (right)
  autoTable(doc, {
    startY: earningsStartY,
    head: [['DEDUCTIONS', 'Amount (GHS)']],
    body: deductionRows,
    foot: [['TOTAL DEDUCTIONS', fmtNum(item.totalDeductions)]],
    showFoot: 'lastPage',
    headStyles: { ...tableHeadStyles, fillColor: [150, 40, 40] },
    bodyStyles: tableBodyStyles,
    footStyles: tableFootStyles,
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 1) data.cell.styles.halign = 'right';
    },
    margin: { left: M + tableW + 4, right: M },
    tableWidth: tableW,
  });
  const deductionsFinalY = lastAutoTable();

  y = Math.max(earningsFinalY, deductionsFinalY) + 6;

  // ── Net Pay in Words + Net Pay (one unified bar) ─────────────────────────
  const totalW = pageW - M * 2;
  const wordsW = totalW * 0.58;
  const netW = totalW - wordsW;
  const netBarH = 22;
  const splitX = M + wordsW;
  const overlap = 3; // hides inner rounded corners so the two halves look like one shape

  // Left half: light fill extended slightly past split to cover its right rounded corners
  doc.setFillColor(232, 237, 248);
  doc.roundedRect(M, y, wordsW + overlap, netBarH, 2, 2, 'F');

  // Right half: dark navy fill overlapping the right edge of the left half
  doc.setFillColor(13, 31, 68);
  doc.roundedRect(splitX - overlap, y, netW + overlap, netBarH, 2, 2, 'F');

  // Outer border over the whole bar
  doc.setDrawColor(190, 205, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, totalW, netBarH, 2, 2, 'S');
  doc.setLineWidth(0.2);

  // Left text: "Net Pay in Words:" + words
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('Net Pay in Words:', M + 5, y + 7);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const words = amountInWords(item.netSalary);
  const lines = doc.splitTextToSize(words, wordsW - 10) as string[];
  doc.text(lines.slice(0, 2), M + 5, y + 14);

  // Right text: NET PAY label + amount — right-aligned within the right box
  const rightEdge = M + totalW - 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 240);
  doc.text('NET PAY', rightEdge, y + 7, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`GHS ${fmtNum(item.netSalary)}`, rightEdge, y + 15, { align: 'right' });

  y += netBarH + 6;

  // ── Year-to-Date Summary ───────────────────────────────────────────────────
  if (ytd) {
    doc.setFillColor(13, 31, 68);
    doc.roundedRect(M, y, totalW, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('YEAR-TO-DATE (YTD) SUMMARY', M + 4, y + 5);
    y += 10;

    const ytdCellW = totalW / 2;
    const ytdRows: [string, string, string, string][] = [
      [
        'YTD Gross Earnings',
        `GHS ${fmtNum(ytd.grossEarnings)}`,
        'YTD PAYE Tax',
        `GHS ${fmtNum(ytd.payeTax)}`,
      ],
      [
        'YTD SSNIT Contribution',
        `GHS ${fmtNum(ytd.ssnitContribution)}`,
        'YTD Net Pay',
        `GHS ${fmtNum(ytd.netPay)}`,
      ],
    ];

    for (const [l1, v1, l2, v2] of ytdRows) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text(l1, M + 4, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(v1, M + ytdCellW - 4, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(l2, M + ytdCellW + 4, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(v2, M + totalW - 4, y + 4, { align: 'right' });

      doc.setDrawColor(220, 220, 220);
      doc.line(M, y + 7, M + totalW, y + 7);
      y += 9;
    }
    y += 2;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.height - 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const footerContact = companyInfo.email
    ? `  |  For queries contact HR: ${companyInfo.email}`
    : '';
  doc.text(
    `This is a computer-generated payslip and does not require a signature.${footerContact}`,
    pageW / 2,
    footerY,
    { align: 'center' },
  );

  const empName = emp ? `${emp.firstName}-${emp.lastName}` : 'payslip';
  doc.save(`payslip-${empName}-${label}.pdf`);
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
    'Deductions',
    'Net Salary',
  ];
  const rows = detail.items.map((item) => [
    item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    item.employee?.employeeNumber ?? '',
    item.employee?.jobTitle ?? '',
    fmtNum(item.basicSalary),
    lineItemsSummary(payrollAllowanceRows(item), item.totalAllowances),
    fmtNum(item.grossSalary),
    fmtNum(item.employeeSSNIT),
    fmtNum(item.employerSSNIT),
    fmtNum(item.payeTax),
    lineItemsSummary(payrollDeductionRows(item), item.otherDeductions),
    fmtNum(item.netSalary),
  ]);
  const meta = companyName ? [[companyName], [`Payroll Report — ${label}`], []] : [];
  triggerCSV(`payroll-full-${label}.csv`, [...meta, headers, ...rows]);
}

export async function downloadP9FormPDF(
  payslips: PayrollItem[],
  year: number,
  company: PayslipCompanyInfo,
  employee?: PayslipEmployeeInfo,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const M = 10;
  const cW = pageW - M * 2;
  let y = M;

  const navy: [number, number, number] = [13, 31, 68];
  const lastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const byMonth: Record<number, PayrollItem> = {};
  payslips
    .filter((p) => p.payrollRun?.year === year)
    .forEach((p) => {
      if (p.payrollRun) byMonth[p.payrollRun.month] = p;
    });

  const getField = (item: PayrollItem, key: string): string => {
    return (item as unknown as Record<string, string>)[key] ?? '0';
  };

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text(company.name || 'EMPLOYER', M, y + 7);

  const contactParts: string[] = [];
  if (company.phone) contactParts.push(company.phone);
  if (company.email) contactParts.push(company.email);
  const contactLine = contactParts.join('  |  ');
  if (contactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(contactLine, M, y + 13);
  }

  const rightEdgeX = M + cW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...navy);
  doc.text('P9 FORM', rightEdgeX, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPLOYEE TAX DEDUCTION CARD', rightEdgeX, y + 13, { align: 'right' });
  doc.text('Ghana Revenue Authority  |  Income Tax Act, 2000 (Act 592)', rightEdgeX, y + 18, {
    align: 'right',
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...navy);
  doc.text(`Year of Assessment: ${year}`, rightEdgeX, y + 24, { align: 'right' });

  y += 28;
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + cW, y);
  y += 4;

  // ── Section header helper ─────────────────────────────────────────────────
  const sectionHeader = (letter: string, title: string) => {
    doc.setFillColor(...navy);
    doc.rect(M, y, cW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${letter}   ${title}`, M + 3, y + 4.5);
    y += 8;
  };

  // ── Field drawing helpers ─────────────────────────────────────────────────
  const drawLabelValue = (
    label: string,
    value: string | undefined | null,
    x: number,
    fy: number,
    totalW: number,
    labelW: number,
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, fy + 4.5);
    const valX = x + labelW;
    const valW = totalW - labelW;
    const val = value ?? '';
    if (val) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(20, 20, 20);
      const truncated = (doc.splitTextToSize(val, valW) as string[])[0];
      doc.text(truncated, valX, fy + 4.5);
    } else {
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.2);
      doc.line(valX, fy + 5.5, x + totalW, fy + 5.5);
    }
  };

  const fieldH = 7;
  const halfW = cW / 2 - 2;

  // ── Section A: Employer Details ───────────────────────────────────────────
  sectionHeader('A', 'EMPLOYER DETAILS');
  drawLabelValue('Employer Name:', company.name, M, y, halfW, 30);
  drawLabelValue('Contact:', contactLine || undefined, M + halfW + 4, y, halfW, 22);
  y += fieldH;
  drawLabelValue('Employer TIN:', undefined, M, y, halfW, 30);
  drawLabelValue('GRA District Office:', undefined, M + halfW + 4, y, halfW, 38);
  y += fieldH + 3;

  // ── Section B: Employee Details ───────────────────────────────────────────
  sectionHeader('B', 'EMPLOYEE DETAILS');
  const qW = cW / 4 - 1;
  const empFullName = employee ? `${employee.firstName} ${employee.lastName}` : undefined;
  const bankText =
    employee?.bankName && employee.bankBranch
      ? `${employee.bankName} (${employee.bankBranch})`
      : (employee?.bankName ?? undefined);

  drawLabelValue('Name:', empFullName, M, y, qW, 14);
  drawLabelValue('Employee ID:', employee?.employeeNumber, M + qW + 1, y, qW, 22);
  drawLabelValue('Job Title:', employee?.jobTitle, M + (qW + 1) * 2, y, qW, 18);
  drawLabelValue('TIN:', employee?.tinNumber, M + (qW + 1) * 3, y, qW, 10);
  y += fieldH;
  drawLabelValue('SSNIT No:', employee?.ssnit, M, y, qW, 18);
  drawLabelValue('Department:', employee?.department, M + qW + 1, y, qW, 22);
  drawLabelValue('Bank:', bankText, M + (qW + 1) * 2, y, qW, 14);
  drawLabelValue('Account No:', employee?.bankAccountNumber, M + (qW + 1) * 3, y, qW, 22);
  y += fieldH + 3;

  // ── Section C: Monthly Earnings and Deductions ────────────────────────────
  sectionHeader('C', 'MONTHLY EARNINGS AND DEDUCTIONS (Amount in GHS)');

  const shortMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const descColW = 38;
  const remW = cW - descColW;
  const mColW = parseFloat((remW / 13).toFixed(2));

  const cellRowDefs = [
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'grossSalary', label: 'Gross Earnings' },
    { key: 'employeeSSNIT', label: 'Employee SSNIT (5.5%)' },
    { key: 'taxableIncome', label: 'Taxable Income' },
    { key: 'payeTax', label: 'Income Tax (PAYE)' },
    { key: 'totalDeductions', label: 'Total Deductions' },
    { key: 'netSalary', label: 'Net Pay' },
  ];

  const tableBody = cellRowDefs.map(({ key, label }) => {
    const monthVals = shortMonths.map((_, i) => {
      const p = byMonth[i + 1];
      return p ? fmtNum(getField(p, key)) : '';
    });
    const rowTotal = shortMonths.reduce((sum, _, i) => {
      const p = byMonth[i + 1];
      return sum + (p ? parseFloat(getField(p, key)) || 0 : 0);
    }, 0);
    const hasAny = monthVals.some((v) => v !== '');
    return [label, ...monthVals, hasAny ? fmtNum(rowTotal) : ''];
  });

  autoTable(doc, {
    startY: y,
    head: [['', ...shortMonths, 'Total']],
    body: tableBody,
    headStyles: {
      fillColor: [230, 235, 245] as [number, number, number],
      textColor: navy,
      fontSize: 6,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.5,
    },
    bodyStyles: { fontSize: 6, halign: 'right', cellPadding: 1.5 },
    columnStyles: {
      0: { halign: 'left', cellWidth: descColW },
      ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { cellWidth: mColW }])),
      13: {
        cellWidth: mColW,
        fontStyle: 'bold',
        fillColor: [230, 235, 245] as [number, number, number],
        textColor: navy,
      },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] as [number, number, number] },
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index > 0 && data.cell.raw === '') {
        const { x, y: cy, height: ch, width: cw } = data.cell;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.15);
        doc.line(x + 1, cy + ch - 1.5, x + cw - 1, cy + ch - 1.5);
      }
    },
    margin: { left: M, right: M },
    tableWidth: cW,
  });

  y = lastY() + 4;

  if (y > pageH - 55) {
    doc.addPage();
    y = M;
  }

  // ── Section D: Annual Summary ─────────────────────────────────────────────
  sectionHeader('D', 'ANNUAL SUMMARY');

  const annualTotals = cellRowDefs.map(({ key, label }) => ({
    label,
    total: shortMonths.reduce((sum, _, i) => {
      const p = byMonth[i + 1];
      return sum + (p ? parseFloat(getField(p, key)) || 0 : 0);
    }, 0),
  }));

  const dHalfW = cW / 2 - 4;
  const dLabelW = 44;

  for (let i = 0; i < annualTotals.length; i += 2) {
    const left = annualTotals[i];
    const right = annualTotals[i + 1];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`${left.label}:`, M, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      left.total > 0 ? `GHS ${fmtNum(left.total)}` : '—',
      M + dLabelW + dHalfW - dLabelW,
      y + 4.5,
      { align: 'right' },
    );

    if (right) {
      const rx = M + dHalfW + 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`${right.label}:`, rx, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        right.total > 0 ? `GHS ${fmtNum(right.total)}` : '—',
        rx + dHalfW - dLabelW + dLabelW,
        y + 4.5,
        { align: 'right' },
      );
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.15);
    doc.line(M, y + 6.5, M + cW, y + 6.5);
    y += 8;
  }

  y += 3;

  if (y > pageH - 45) {
    doc.addPage();
    y = M;
  }

  // ── Section E: Reliefs and Allowances (omitted — not tracked by system) ──

  sectionHeader('E', 'RELIEFS AND ALLOWANCES (For Reference Only)');
  const reliefs = [
    'Personal Relief (GHS 1,200)',
    'Marriage/Responsibility Relief',
    'Child Education Relief',
    'Old Age / Disability Relief',
    'Aged Dependent Relative Relief',
    'Self-Education Relief',
  ];
  const relColW = cW / 3 - 2;
  for (let i = 0; i < reliefs.length; i += 3) {
    const row = reliefs.slice(i, i + 3);
    for (let j = 0; j < row.length; j++) {
      const rx = M + j * (relColW + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`${row[j]}:`, rx, y + 4.5);
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.2);
      doc.line(rx + relColW - 28, y + 5.5, rx + relColW, y + 5.5);
    }
    y += 8;
  }
  y += 3;

  if (y > pageH - 35) {
    doc.addPage();
    y = M;
  }

  // ── Section F: Certification and Declaration ──────────────────────────────
  sectionHeader('F', 'CERTIFICATION AND DECLARATION');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  const declaration =
    'I hereby certify that the information given in this form is correct and complete to the best of my knowledge and belief. This form was prepared in accordance with the provisions of the Income Tax Act, 2000 (Act 592) and submitted to the Ghana Revenue Authority.';
  const declLines = doc.splitTextToSize(declaration, cW) as string[];
  doc.text(declLines, M, y + 4);
  y += declLines.length * 4 + 8;

  const sigW = cW / 3 - 4;
  const sigs = [
    { label: "Employer's Signature", sub: 'Name & Designation' },
    { label: 'Date', sub: '' },
    { label: 'Official Stamp / Seal', sub: '' },
  ];

  for (let i = 0; i < sigs.length; i++) {
    const sx = M + i * (sigW + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`${sigs[i].label}:`, sx, y + 4);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.25);
    doc.line(sx, y + 10, sx + sigW, y + 10);
    if (sigs[i].sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(140, 140, 140);
      doc.text(sigs[i].sub, sx, y + 14);
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = pageH - 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    'GRA Helpline: 0800-900-110 (Toll Free)  |  www.gra.gov.gh  |  This form is for official tax reporting purposes only.',
    pageW / 2,
    footY,
    { align: 'center' },
  );

  const empSuffix = employee ? `${employee.lastName}-${employee.firstName}` : 'employee';
  doc.save(`P9-Form-${empSuffix}-${year}.pdf`);
}

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

  const transportAmt = parseFloat(item.transportAmount);
  const otherAllowances = parseFloat(item.totalAllowances) - transportAmt;
  const earningsRows: string[][] = [['Basic Salary', fmtNum(item.basicSalary)]];
  if (transportAmt > 0) earningsRows.push(['Transport Allowance', fmtNum(item.transportAmount)]);
  if (otherAllowances > 0) earningsRows.push(['Other Allowances', fmtNum(otherAllowances)]);
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
  if (parseFloat(item.otherDeductions) > 0)
    deductionRows.push(['Other Deductions', fmtNum(item.otherDeductions)]);

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

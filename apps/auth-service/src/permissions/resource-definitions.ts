export const RESOURCES = [
  {
    name: 'users',
    module: 'AUTH',
    description: 'User accounts and invitations',
  },
  {
    name: 'user-security',
    module: 'AUTH',
    description: 'User security actions such as forced password resets',
  },
  { name: 'tenants', module: 'AUTH', description: 'Company tenants' },
  {
    name: 'permission-sets',
    module: 'AUTH',
    description: 'Permission set bundles',
  },
  { name: 'audit-logs', module: 'AUTH', description: 'Audit trail' },

  { name: 'employees', module: 'HR', description: 'Employee profiles' },
  {
    name: 'employee-profile',
    module: 'HR',
    description: 'Employee self-service profile access',
  },
  {
    name: 'offboarding',
    module: 'HR',
    description: 'Employee offboarding and exit workflows',
  },
  { name: 'resignations', module: 'HR', description: 'Employee resignations' },
  { name: 'departments', module: 'HR', description: 'Department management' },
  { name: 'branches', module: 'HR', description: 'Branch locations' },
  { name: 'hr-settings', module: 'HR', description: 'HR workspace settings' },
  {
    name: 'leave',
    module: 'HR',
    description: 'Company-wide leave requests and approvals',
  },
  {
    name: 'leave-self',
    module: 'HR',
    description: 'Employee self-service leave access',
  },
  {
    name: 'leave-settings',
    module: 'HR',
    description: 'Leave types, public holidays and balance administration',
  },
  { name: 'attendance', module: 'HR', description: 'Clock-in/out records' },
  { name: 'timesheets', module: 'HR', description: 'Weekly timesheets' },
  {
    name: 'time-corrections',
    module: 'HR',
    description: 'Time correction requests',
  },
  { name: 'schedules', module: 'HR', description: 'Shift schedules' },
  { name: 'payroll', module: 'HR', description: 'Payroll runs and approvals' },
  {
    name: 'payslip-self',
    module: 'HR',
    description: 'Employee self-service payslip access',
  },
  {
    name: 'appraisals',
    module: 'HR',
    description: 'Company appraisal records and cycle-generated reviews',
  },
  {
    name: 'appraisal-settings',
    module: 'HR',
    description: 'Appraisal cycles, templates and KPI configuration',
  },
  {
    name: 'self-appraisals',
    module: 'HR',
    description: 'Employee self-service appraisal access and submissions',
  },
  {
    name: 'appraisal-reviews',
    module: 'HR',
    description: 'Manager appraisal review workflows',
  },
  { name: 'assets', module: 'HR', description: 'Company asset management' },
  {
    name: 'projects',
    module: 'HR',
    description: 'Company projects and project membership',
  },
  {
    name: 'project-tasks',
    module: 'HR',
    description: 'Project task assignment and task execution',
  },
  { name: 'announcements', module: 'HR', description: 'Company announcements' },
  { name: 'documents', module: 'HR', description: 'Employee documents' },
  { name: 'allowances', module: 'HR', description: 'Employee allowances' },

  {
    name: 'payroll-reports',
    module: 'FINANCE',
    description: 'Payroll financial reports',
  },
  {
    name: 'expense-reports',
    module: 'FINANCE',
    description: 'Expense reports',
  },
  {
    name: 'accounting.settings',
    module: 'ACCOUNTING',
    description: 'Accounting configuration, currencies and fiscal periods',
  },
  {
    name: 'accounting.accounts',
    module: 'ACCOUNTING',
    description: 'Chart of accounts, cost centres and subledger accounts',
  },
  {
    name: 'accounting.account-classifications',
    module: 'ACCOUNTING',
    description: 'Accounting account hierarchy classifications',
  },
  {
    name: 'accounting.account-groups',
    module: 'ACCOUNTING',
    description: 'Accounting account hierarchy groups',
  },
  {
    name: 'accounting.customers',
    module: 'ACCOUNTING',
    description: 'Accounting customer master records and AR subledgers',
  },
  {
    name: 'accounting.vendors',
    module: 'ACCOUNTING',
    description: 'Accounting vendor master records and AP subledgers',
  },
  {
    name: 'accounting.cash-accounts',
    module: 'ACCOUNTING',
    description: 'Accounting-owned cash, bank and wallet account masters',
  },
  {
    name: 'accounting.cashbook',
    module: 'ACCOUNTING',
    description: 'Standalone Accounting cashbook transaction workflows',
  },
  {
    name: 'accounting.receivables',
    module: 'ACCOUNTING',
    description:
      'Standalone Accounting accounts receivable documents, receipts and allocations',
  },
  {
    name: 'accounting.payables',
    module: 'ACCOUNTING',
    description:
      'Standalone Accounting accounts payable documents, payments and allocations',
  },
  {
    name: 'accounting.budgets',
    module: 'ACCOUNTING',
    description: 'Period budgets by account and cost centre, with actuals',
  },
  {
    name: 'accounting.journals',
    module: 'ACCOUNTING',
    description: 'Draft, post and reverse journal entries',
  },
  {
    name: 'accounting.ledger',
    module: 'ACCOUNTING',
    description: 'Posted general-ledger activity',
  },

  {
    name: 'marketing.crm-settings',
    module: 'MARKETING',
    description: 'Marketing CRM settings administration',
  },
  {
    name: 'marketing.pipeline-stages',
    module: 'MARKETING',
    description: 'Marketing sales pipeline stage configuration',
  },
  {
    name: 'marketing.products',
    module: 'MARKETING',
    description: 'Marketing product and service options',
  },
  {
    name: 'marketing.decision-makers',
    module: 'MARKETING',
    description: 'Marketing decision maker and role title options',
  },
  {
    name: 'marketing.source-types',
    module: 'MARKETING',
    description: 'Marketing prospect source type options',
  },
  {
    name: 'marketing.interaction-media',
    module: 'MARKETING',
    description: 'Marketing prospect interaction medium options',
  },
  {
    name: 'marketing.business-types',
    module: 'MARKETING',
    description: 'Marketing prospect business type options',
  },
  {
    name: 'marketing.prospects',
    module: 'MARKETING',
    description: 'Marketing prospect records and sales pipeline assignments',
  },
  {
    name: 'marketing.prospects.all',
    module: 'MARKETING',
    description: 'Tenant-wide Marketing prospect list visibility',
  },
  {
    name: 'marketing.clients',
    module: 'MARKETING',
    description: 'Marketing client records and prospect conversion',
  },
  {
    name: 'marketing.clients.all',
    module: 'MARKETING',
    description: 'Tenant-wide Marketing client list visibility',
  },
  {
    name: 'marketing.clients.billing',
    module: 'MARKETING',
    description: 'Raise and review client billing transactions in Accounting',
  },
  {
    name: 'marketing.targets',
    module: 'MARKETING',
    description: 'Set and review sales rep revenue targets',
  },
  {
    name: 'marketing.targets.all',
    module: 'MARKETING',
    description:
      'Tenant-wide view of every sales rep target and their progress',
  },
  {
    name: 'marketing.prospects.interactions',
    module: 'MARKETING',
    description: 'Marketing prospect interaction history records',
  },
  {
    name: 'marketing.prospects.interactions.all',
    module: 'MARKETING',
    description: 'Tenant-wide Marketing prospect interaction history access',
  },
  {
    name: 'marketing.follow-ups',
    module: 'MARKETING',
    description: 'Marketing prospect follow-up scheduling and worklists',
  },
  {
    name: 'marketing.follow-ups.all',
    module: 'MARKETING',
    description: 'Tenant-wide Marketing prospect follow-up scheduling access',
  },
  {
    name: 'marketing.fleet',
    module: 'MARKETING',
    description: 'Marketing fleet vehicles linked to HR vehicle assets',
  },
  {
    name: 'marketing.requests',
    module: 'MARKETING',
    description:
      'Marketing transport requests the user raised: create, edit while pending, cancel',
  },
  {
    name: 'marketing.requests.all',
    module: 'MARKETING',
    description:
      'Tenant-wide Marketing transport request visibility and approval',
  },
  {
    name: 'marketing.appointments.all',
    module: 'MARKETING',
    description:
      'Tenant-wide Marketing appointment visibility, booking on behalf of other marketers, and approval',
  },
  {
    name: 'marketing.transport-officers',
    module: 'MARKETING',
    description:
      'Marketing transport officers (drivers) added from the employee list',
  },
  {
    name: 'marketing.campaigns',
    module: 'MARKETING',
    description:
      'Marketing SMS and email campaigns to prospects by business type',
  },
  {
    name: 'marketing.sms-sender-identities',
    module: 'MARKETING',
    description: 'Tenant SMS sender identities used by Marketing campaigns',
  },
  {
    name: 'marketing.domains',
    module: 'MARKETING',
    description:
      'Tenant business domains used for communication identity verification',
  },
  {
    name: 'marketing.sms-wallet',
    module: 'MARKETING',
    description: 'Tenant SMS credit wallet balance and ledger visibility',
  },
  {
    name: 'marketing.sms-credits',
    module: 'MARKETING',
    description:
      'Administrative SMS credit adjustments for Marketing campaigns',
  },

  {
    name: 'operations.reinsurance.dashboard',
    module: 'OPERATIONS',
    description: 'Reinsurance operations dashboard',
  },
  {
    name: 'operations.reinsurance.accounting-operations',
    module: 'OPERATIONS',
    description:
      'Reinsurance Accounting integration operational diagnostics and support actions',
  },
  {
    name: 'operations.reinsurance.placements',
    module: 'OPERATIONS',
    description: 'Reinsurance placement workflows',
  },
  {
    name: 'operations.reinsurance.facultative-offers.create-offer',
    module: 'OPERATIONS',
    description: 'Create new Reinsurance facultative offers',
  },
  {
    name: 'operations.reinsurance.facultative-offers.edit-offer',
    module: 'OPERATIONS',
    description: 'Edit material Reinsurance facultative offer details',
  },
  {
    name: 'operations.reinsurance.facultative-offers.partial-edit',
    module: 'OPERATIONS',
    description:
      'Apply non-material Reinsurance facultative offer edits such as policy number changes',
  },
  {
    name: 'operations.reinsurance.facultative-offers.reopen-offer',
    module: 'OPERATIONS',
    description:
      'Reopen unpaid closed Reinsurance facultative offers into the closing workflow',
  },
  {
    name: 'operations.reinsurance.facultative-offers.force-close',
    module: 'OPERATIONS',
    description:
      'Force close Reinsurance facultative offers using agreed closing capacity',
  },
  {
    name: 'operations.reinsurance.facultative-offers.endorse-offer',
    module: 'OPERATIONS',
    description:
      'Initiate and manage Reinsurance facultative endorsement workflows',
  },
  {
    name: 'operations.reinsurance.facultative-offers.archive-offer',
    module: 'OPERATIONS',
    description:
      'Archive Reinsurance facultative offers while preserving history',
  },
  {
    name: 'operations.reinsurance.premiums.receive-from-cedant',
    module: 'OPERATIONS',
    description: 'Record inbound Reinsurance premium receipts from cedants',
  },
  {
    name: 'operations.reinsurance.premiums.disburse-to-reinsurer',
    module: 'OPERATIONS',
    description:
      'Record outbound Reinsurance premium disbursements to reinsurers',
  },
  {
    name: 'operations.reinsurance.premiums.reverse-payment',
    module: 'OPERATIONS',
    description: 'Reverse Reinsurance premium receipts or disbursements',
  },
  {
    name: 'operations.reinsurance.counterparties',
    module: 'OPERATIONS',
    description: 'Reinsurance counterparties and contacts',
  },
  {
    name: 'operations.reinsurance.claims',
    module: 'OPERATIONS',
    description: 'Reinsurance claims workflows',
  },
  {
    name: 'operations.reinsurance.claims.add-claim',
    module: 'OPERATIONS',
    description: 'Create Reinsurance claim loss events',
  },
  {
    name: 'operations.reinsurance.claims.create-notification',
    module: 'OPERATIONS',
    description: 'Move Reinsurance claims into notified status',
  },
  {
    name: 'operations.reinsurance.claims.record-recovery',
    module: 'OPERATIONS',
    description: 'Record actual Reinsurance recovery receipts from reinsurers',
  },
  {
    name: 'operations.reinsurance.claims.void-claim',
    module: 'OPERATIONS',
    description: 'Void Reinsurance claims while preserving audit history',
  },
  {
    name: 'operations.reinsurance.email',
    module: 'OPERATIONS',
    description: 'Broker correspondence and linked email threads',
  },
  {
    name: 'operations.reinsurance.email-settings',
    module: 'OPERATIONS',
    description: 'Broker mailbox integration settings',
  },
  {
    name: 'operations.reinsurance.reports',
    module: 'OPERATIONS',
    description: 'Reinsurance operational reports',
  },
  {
    name: 'operations.reinsurance.settings',
    module: 'OPERATIONS',
    description: 'Reinsurance module configuration',
  },
  {
    name: 'operations.reinsurance.taxes-levies',
    module: 'OPERATIONS',
    description: 'Reinsurance taxes, levies and charge configuration',
  },

  {
    name: 'platform-settings',
    module: 'PLATFORM',
    description: 'Platform configuration',
  },
  {
    name: 'subscriptions',
    module: 'PLATFORM',
    description: 'Subscription management',
  },
] as const;

import { Module } from '@/components/organisms/shared/ModuleConfiguration';

export const DEFAULT_MODULES: Module[] = [
  {
    id: 'hr',
    key: 'hr',
    name: 'HR Module',
    description: 'Manage employees, leave, payroll, appraisals and more',
    enabled: false,
    options: [
      {
        key: 'departments',
        label: 'Departments',
        description: 'Manage company departments and structure',
      },
      {
        key: 'branches',
        label: 'Branches',
        description: 'Manage company branch locations',
      },
      {
        key: 'employees',
        label: 'Employees',
        description: 'Manage employee records and profiles',
      },
      {
        key: 'recruitment',
        label: 'Recruitment',
        description: 'Job openings, candidates and hiring settings',
      },
      {
        key: 'leave',
        label: 'Leave Management',
        description: 'Employee leave requests and balances',
      },
      {
        key: 'appraisal',
        label: 'Appraisal',
        description: 'Performance reviews and cycles',
      },
      {
        key: 'timeclock',
        label: 'Time Clock',
        description: 'Clock in/out and attendance tracking',
      },
      {
        key: 'scheduling',
        label: 'Smart Scheduling',
        description: 'Shift and workforce scheduling',
      },
      {
        key: 'payroll',
        label: 'Payroll',
        description: 'Process and manage payroll',
      },
      {
        key: 'assets',
        label: 'Asset Management',
        description: 'Company asset tracking',
      },
      {
        key: 'projects',
        label: 'Projects',
        description: 'Project and task management',
      },
      {
        key: 'smsAnnouncement',
        label: 'SMS Announcement',
        description: 'Allow announcements to be sent via SMS to employee phone numbers',
      },
    ],
  },
  {
    id: 'accounting',
    key: 'accounting',
    name: 'Accounting Module',
    description: 'Manage invoices, expenses, and financial reports',
    enabled: false,
    options: [],
  },
  {
    id: 'marketing',
    key: 'marketing',
    name: 'Marketing Module',
    description: 'Run campaigns, manage the sales CRM, and handle transport',
    enabled: false,
    options: [
      {
        key: 'campaign',
        label: 'Campaign',
        description: 'SMS and email campaigns, sender identities and credits',
      },
      {
        key: 'sales-crm',
        label: 'Sales CRM',
        description: 'Prospects, clients, pipeline stages and sales targets',
      },
      {
        key: 'transport',
        label: 'Transport',
        description: 'Fleet, transport requests and transport officers',
      },
    ],
  },
  {
    id: 'operations',
    key: 'operations',
    name: 'Operation Module',
    description: 'Manage industry-specific operational workflows',
    enabled: false,
    exclusive: true,
    options: [
      {
        key: 'reinsurance',
        label: 'Reinsurance Operations',
        description: 'Broker placements, counterparties and correspondence',
      },
      {
        key: 'inventory',
        label: 'Inventory Management',
        description: 'Track items, stock levels and movements',
      },
    ],
  },
];

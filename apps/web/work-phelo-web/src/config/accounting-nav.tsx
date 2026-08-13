import { NavGroup } from '@/components/organisms/shared/Sidebar';

import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  BookOpenText,
  ChartLine,
  LayoutDashboard,
  LibraryBig,
  NotebookTabsIcon,
  Settings,
  Wallet,
} from 'lucide-react';

const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
const ChartOfAccountsIcon = () => <BookOpenText className="w-5 h-5" />;
const GeneralLedgerIcon = () => <LibraryBig className="w-5 h-5" />;
const JournalEntriesIcon = () => <NotebookTabsIcon className="w-5 h-5" />;
const AccountsPayableIcon = () => <BanknoteArrowUp className="w-5 h-5" />;
const AccountsReceivableIcon = () => <BanknoteArrowDown className="w-5 h-5" />;
const CashAndBankIcon = () => <Wallet className="w-5 h-5" />;
const FinancialReportsIcon = () => <ChartLine className="w-5 h-5" />;
const SettingsIcon = () => <Settings className="w-5 h-5" />;

export const ACCOUNTING_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <DashboardIcon />,
        href: 'dashboard',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Accounting and Finance',
    items: [
      {
        key: 'chart-of-accounts',
        label: 'Chart of Accounts',
        icon: <ChartOfAccountsIcon />,
        href: 'chartsofaccounts',
        enabled: true,
        active: true,
      },
      {
        key: 'general-ledger',
        label: 'General Ledger',
        icon: <GeneralLedgerIcon />,
        href: 'general-ledger',
        enabled: true,
        active: true,
        exact: true,
      },
      {
        key: 'journal-entries',
        label: 'Journal Entries',
        icon: <JournalEntriesIcon />,
        href: 'journalentry',
        enabled: true,
        active: true,
      },
      {
        key: 'accounts-payable',
        label: 'Accounts Payable',
        icon: <AccountsPayableIcon />,
        href: 'accountspayable',
        enabled: true,
        active: true,
      },
      {
        key: 'accounts-receivable',
        label: 'Accounts Receivable',
        icon: <AccountsReceivableIcon />,
        href: 'accountsreceivable',
        enabled: true,
        active: true,
      },
      {
        key: 'cash-and-bank',
        label: 'Cash and Bank',
        icon: <CashAndBankIcon />,
        href: 'cashandbank',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        key: 'financial-reports',
        label: 'Financial Reports',
        icon: <FinancialReportsIcon />,
        href: 'financial-reports',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        key: 'settings',
        label: 'Settings',
        icon: <SettingsIcon />,
        href: 'settings',
        enabled: true,
        active: true,
      },
    ],
  },
];

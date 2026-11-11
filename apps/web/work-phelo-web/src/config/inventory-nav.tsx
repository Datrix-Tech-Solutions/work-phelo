import { NavGroup } from '@/components/organisms/shared/Sidebar';

import {
  ArrowLeftRight,
  Handshake,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Users,
  Warehouse,
} from 'lucide-react';

/* ── Icons ── */
const InventoryIcon = () => <Package className="w-5 h-5" />;
const StockIcon = () => <ArrowLeftRight className="w-5 h-5" />;
const PurchaseIcon = () => <ShoppingCart className="w-5 h-5" />;
const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
const WarehouseIcon = () => <Warehouse className="w-5 h-5" />;
const PartnersIcon = () => <Handshake className="w-5 h-5" />;
const SettingsIcon = () => <Settings className="w-5 h-5" />;
const UserManagementIcon = () => <Users className="w-5 h-5" />;

/* ── Nav groups ── */

export const INVENTORY_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <DashboardIcon />,
        href: '',
        enabled: true,
        active: true,
        exact: true,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        key: 'inventory',
        label: 'Inventory',
        icon: <InventoryIcon />,
        href: 'items',
        enabled: true,
        active: true,
      },
      {
        key: 'stock-management',
        label: 'Stock Management',
        icon: <StockIcon />,
        href: 'stock-management',
        enabled: true,
        active: true,
      },
      {
        key: 'purchase-orders',
        label: 'Purchase Orders',
        icon: <PurchaseIcon />,
        href: 'purchase-orders',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Directory',
    items: [
      {
        key: 'warehouses',
        label: 'Warehouses',
        icon: <WarehouseIcon />,
        href: 'warehouses',
        enabled: true,
        active: true,
      },
      {
        key: 'suppliers-customers',
        label: 'Suppliers & Customers',
        icon: <PartnersIcon />,
        href: 'suppliers-customers',
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
      {
        key: 'user-management',
        label: 'User Management',
        icon: <UserManagementIcon />,
        href: 'user-management',
        enabled: true,
        active: true,
      },
    ],
  },
];

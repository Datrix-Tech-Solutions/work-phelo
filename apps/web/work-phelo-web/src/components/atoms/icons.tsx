import {
  // Navigation & UI
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Download,
  Edit,
  Trash2,
  Plus,
  X,
  Upload,
  PlusIcon,
  ListFilter,
  EllipsisVertical,
  CircleX,
  CircleCheck,
  Eye,
  EyeOff,

  // Time & Status
  Clock,
  PartyPopper,

  // People
  User,
  Users,
  UserMinus,
  UserPen,
  Phone,
  Mail,

  // Business / HR
  Building2,
  TrendingUp,
  CircleDollarSign,

  // Devices / Assets
  LaptopMinimal,
  Smartphone,
  Monitor,
  Printer,
  CarFront,
  Armchair,
  KeyRound,
  Headphones,
  Package,

  // Quick Actions
  MonitorSmartphone,
  CalendarRange,

  // Module icons — aligned with hr-nav.tsx
  LayoutDashboard,
  Building,
  Network,
  CalendarCheck,
  ClipboardList,
  Trophy,
  Timer,
  FileSliders,

  // Other modules
  Activity,
  DollarSign,
  Handshake,
  Calendar,
  GripVertical,
  Pencil,
  Check,
  SendHorizonal,
} from 'lucide-react';

/** General-purpose icon map used throughout the app */
export const Icons = {
  // Navigation
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Search,
  Download,

  // Actions
  UserMinus,
  UserPen,
  Edit,
  Trash2,
  Plus,
  X,
  Upload,
  PlusIcon,
  ListFilter,
  EllipsisVertical,
  CircleX,
  CircleCheck,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Check,

  // Time & Status
  Clock,
  PartyPopper,

  // Business / HR
  Building2,
  User,
  Users,
  TrendingUp,
  CircleDollarSign,

  // Devices / Assets
  LaptopMinimal,
  Smartphone,
  Monitor,
  Printer,
  CarFront,
  Armchair,
  KeyRound,
  Headphones,
  Package,

  // Quick Actions
  MonitorSmartphone,
  CalendarRange,

  // Contact
  Phone,
  Mail,
  SendHorizonal,

  // Other modules
  Activity,
  DollarSign,
  Handshake,
} as const;

export type IconName = keyof typeof Icons;

// ---------------------------------------------------------------------------
// Module + feature icon registry
// Kept in sync with hr-nav.tsx so sidebar and other icon surfaces always match
// ---------------------------------------------------------------------------

/** Icon for each module / HR feature key */
export const ModuleIcons = {
  // ── Top-level modules ──────────────────────────────────────────────────
  hr: Users,
  marketing: Activity,
  accounting: DollarSign,
  operations: Handshake,

  // ── HR features (mirror hr-nav.tsx exactly) ───────────────────────────
  dashboard: LayoutDashboard,
  departments: Building,
  branches: Network,
  employees: Users,
  leave: CalendarRange,
  appraisal: Trophy,
  timeclock: Timer,
  scheduling: CalendarCheck,
  projects: ClipboardList,
  payroll: CircleDollarSign,
  assets: MonitorSmartphone,
  management: FileSliders,
} as const;

export type ModuleKey = keyof typeof ModuleIcons;

// ---------------------------------------------------------------------------
// Module color palette
// Change a value here → updates everywhere: dashboard cards, quick-actions, etc.
// ---------------------------------------------------------------------------

/** CSS variable reference per top-level module */
export const MODULE_COLORS: Record<string, string> = {
  hr: 'var(--module-hr)',
  marketing: 'var(--module-marketing)',
  accounting: 'var(--module-accounting)',
  operations: 'var(--module-operations)',
};

/** Which module each HR feature belongs to — for inheriting the right color */
export const FEATURE_MODULE: Record<string, string> = {
  dashboard: 'hr',
  departments: 'hr',
  branches: 'hr',
  employees: 'hr',
  leave: 'hr',
  appraisal: 'hr',
  timeclock: 'hr',
  scheduling: 'hr',
  projects: 'hr',
  payroll: 'hr',
  assets: 'hr',
  management: 'hr',
};

/** Resolve the background color for any module or feature key */
export function moduleColor(key: string): string {
  const parent = FEATURE_MODULE[key] ?? key;
  return MODULE_COLORS[parent] ?? 'var(--module-hr)';
}

import {
  // Navigation & UI
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Search,
  Download,
  Edit,
  Trash2,
  Plus,
  X,
  Clock,
  User,
  Users,
  Building2,
  LaptopMinimal,
  Smartphone,
  Monitor,
  Printer,
  CarFront,
  Armchair,
  KeyRound,
  Headphones,
  Package,
  PartyPopper,
  TrendingUp,
  CircleDollarSign,
  MonitorSmartphone,
  CalendarRange,
  UserMinus,
  UserPen,
  Upload,
  PlusIcon,
  ListFilter,
} from 'lucide-react';

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
} as const;

export type IconName = keyof typeof Icons;

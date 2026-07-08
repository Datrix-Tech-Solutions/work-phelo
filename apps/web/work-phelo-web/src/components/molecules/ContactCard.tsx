'use client';

import Image from 'next/image';
import { MapPin, UserPlus, Trash2, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

const AVATAR_PALETTES = [
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-red-100', text: 'text-red-700' },
];

const PILL_COLORS = {
  green: 'border-green-300 text-green-800',
  yellow: 'border-amber-300 text-amber-800',
  red: 'border-red-300 text-red-800',
  blue: 'border-blue-300 text-blue-800',
  gray: 'border-gray-300 text-gray-600',
} as const;

export type PillColor = keyof typeof PILL_COLORS;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function pickPalette(name: string) {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

function Pill({
  color,
  icon,
  children,
}: {
  color: PillColor;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold w-fit',
        PILL_COLORS[color],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = getInitials(name);
  const palette = pickPalette(name);

  if (avatarUrl) {
    return (
      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
        <Image
          src={avatarUrl}
          alt={name}
          width={56}
          height={56}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn('w-14 h-14 rounded-full flex items-center justify-center shrink-0', palette.bg)}
    >
      <span className={cn('text-sm font-semibold', palette.text)}>{initials}</span>
    </div>
  );
}

export interface ContactCardDetail {
  label: string;
  value: string;
  dotColor?: string;
}

interface ContactCardProps {
  name: string;
  avatarUrl?: string;
  /** Plain text under the name — e.g. a job title. */
  subtitle?: string;
  /** Pill under the name, MapPin icon — e.g. a cedant/reinsurer's territory. */
  location?: string;
  /** Pill in the top-right corner of the header row, same styling as the location pill. */
  statusPill?: { label: string; color: PillColor };
  /** Optional 2-column detail grid rendered between the header and the divider. */
  details?: ContactCardDetail[];
  email: string;
  phone: string;
  /** Floating notification badge that straddles the top border — e.g. an outstanding count. */
  badge?: { count: number; label: string };
  onClick?: () => void;
  onAddPerson?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function ContactCard({
  name,
  avatarUrl,
  subtitle,
  location,
  statusPill,
  details,
  email,
  phone,
  badge,
  onClick,
  onAddPerson,
  onDelete,
  className,
}: ContactCardProps) {
  const hasActions = !!(onAddPerson || onDelete);

  return (
    <div
      className={cn(
        'group relative bg-white rounded-xl p-4 w-95 h-full flex flex-col gap-4',
        'border border-gray-100 transition-all duration-200',
        'hover:border-(--module-border,var(--color-purple-100)) hover:shadow-xl hover:-translate-y-1.5',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {/* Notification badge — straddles the top border */}
      {badge && (
        <div
          className="absolute top-0 right-6 -translate-y-1/3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="group/badge flex items-center border border-orange-300 bg-white text-orange-600 text-[11px] font-semibold rounded-full px-1.5 py-0.5 ring-1 ring-white cursor-default whitespace-nowrap">
            <span>{badge.count}</span>
            <span className="grid grid-cols-[0fr] group-hover/badge:grid-cols-[1fr] transition-[grid-template-columns] duration-200 overflow-hidden">
              <span className="overflow-hidden pl-1">{badge.label}</span>
            </span>
          </div>
        </div>
      )}

      {/* Action buttons — visible on hover */}
      {hasActions && (
        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddPerson?.();
            }}
            className="p-2 bg-gray-100 rounded-lg text-blue-300 hover:bg-blue-200 hover:text-blue-800 transition-colors"
            aria-label="Add person"
          >
            <UserPlus size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="p-2 bg-gray-100 rounded-lg text-red-300 hover:bg-red-50 hover:text-red-600 transition-colors"
            aria-label="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {/* Header: avatar + name + subtitle/location — status pill on the right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar name={name} avatarUrl={avatarUrl} />
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-sm font-bold text-gray-900 leading-snug">{name}</span>
            {subtitle && <span className="text-sm text-gray-400">{subtitle}</span>}
            {location && (
              <Pill color="green" icon={<MapPin size={10} />}>
                {location}
              </Pill>
            )}
          </div>
        </div>
        {statusPill && <Pill color={statusPill.color}>{statusPill.label}</Pill>}
      </div>

      {/* Optional detail grid — e.g. department + hire date */}
      {details && details.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {details.map((d) => (
            <div key={d.label}>
              <p className="text-xs text-gray-400">{d.label}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
                {d.dotColor && (
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', d.dotColor)} />
                )}
                {d.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <hr className="border-gray-100" />

      {/* Contact info */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-gray-600 text-sm">
          <Mail size={14} className="shrink-0 text-gray-400" />
          <span>{email}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 text-sm">
          <Phone size={14} className="shrink-0 text-gray-400" />
          <span>{phone}</span>
        </div>
      </div>
    </div>
  );
}

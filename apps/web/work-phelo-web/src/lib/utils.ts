import type { CSSProperties } from 'react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inputClass(error?: string, extra?: string) {
  return cn(
    'w-full px-4 py-3 border rounded-input text-sm bg-white/90 backdrop-blur-sm text-gray-800',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none focus:bg-white',
    error
      ? 'border-red-500 focus:ring-2 focus:ring-red-500/30 focus:border-red-500'
      : 'border-(--module-border,var(--color-gray-300)) focus:ring-2 focus:ring-(--module-btn-bg,var(--color-brand))/30 focus:border-(--module-btn-bg,var(--color-brand))',
    extra,
  );
}

export function cardClass(extra?: string, border: 'module' | 'glass' = 'module') {
  return cn(
    'bg-(--glass-subtle,rgba(255,255,255,0.3)) backdrop-blur-md rounded-xl border shadow-lg',
    border === 'module' ? 'border-(--module-border,var(--color-gray-200))' : 'border-white/40',
    extra,
  );
}

/** Popup/panel surfaces (SidePanel, DatePicker/SearchSelect dropdowns) — near-solid for
 * legibility, unlike the more translucent cardClass()/glass-strong ambient surfaces. */
export function popupClass(extra?: string) {
  return cn(
    'bg-(--glass-solid,rgba(255,255,255,0.9)) backdrop-blur-md rounded-card border border-gray-200 shadow-xl',
    extra,
  );
}

/** Same "strong" glass surface as TopNav/Sidebar/DataCard/ModuleButton/ContactCard — more opaque than cardClass(). */
export function glassStrongClass(extra?: string, border: 'module' | 'plain' | 'none' = 'module') {
  return cn(
    'bg-(--glass-strong,rgba(255,255,255,0.6)) backdrop-blur-md',
    border === 'module' && 'border border-(--module-border,var(--color-gray-200))',
    border === 'plain' && 'border border-gray-200',
    extra,
  );
}

/** Frosted color-tint finish, same recipe as the quick-action icon circles — softer/quieter than waterAvatarStyle. */
export function frostedAvatarStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklab, ${color} 78%, white 22%)`,
    boxShadow: `0 6px 14px -4px color-mix(in srgb, ${color} 45%, transparent)`,
  };
}

/** 3D glass/water-drop finish for an avatar circle, tinted by the given color. */
export function waterAvatarStyle(color: string): CSSProperties {
  return {
    background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.92) 0%, color-mix(in oklab, ${color} 30%, white) 30%, color-mix(in oklab, ${color} 65%, white) 60%, color-mix(in oklab, ${color} 90%, white) 100%)`,
    boxShadow: [
      `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`,
      `inset -2px -2px 4px color-mix(in srgb, color-mix(in oklab, ${color} 60%, black) 35%, transparent)`,
      'inset 1.5px 1.5px 3px rgba(255,255,255,0.85)',
      `0 4px 8px -2px color-mix(in srgb, ${color} 55%, transparent)`,
    ].join(', '),
    textShadow: '0 1px 2px rgba(0,0,0,0.35)',
  };
}

/** Lighter, more translucent water-glass finish for a small icon circle (e.g. UpcomingHolidaysCard),
 * tinted by the given color. Lets more of the card behind it show through than waterAvatarStyle. */
export function waterIconStyle(color: string): CSSProperties {
  return {
    background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.95) 0%, color-mix(in srgb, color-mix(in oklab, ${color} 25%, white) 85%, transparent) 30%, color-mix(in srgb, color-mix(in oklab, ${color} 60%, white) 65%, transparent) 60%, color-mix(in srgb, ${color} 55%, transparent) 100%)`,
    boxShadow: [
      `inset -2px -2px 4px color-mix(in srgb, color-mix(in oklab, ${color} 70%, black) 25%, transparent)`,
      'inset 1.5px 1.5px 3px rgba(255,255,255,0.9)',
      `0 3px 6px -1px color-mix(in srgb, ${color} 45%, transparent)`,
    ].join(', '),
  };
}

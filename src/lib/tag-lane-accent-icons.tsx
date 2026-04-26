import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Box,
  Flame,
  Hammer,
  Layers,
  Palette,
  Printer,
  Sparkles,
  Wrench,
} from 'lucide-react';

/** Allowlist for widget header icons (no dynamic icon imports). */
export const TAG_LANE_ACCENT_ICONS: Record<string, LucideIcon> = {
  Box,
  Printer,
  Flame,
  Sparkles,
  Hammer,
  Wrench,
  Layers,
  Palette,
};

export type TagLaneAccentLucideKey = keyof typeof TAG_LANE_ACCENT_ICONS;

export const TAG_LANE_ACCENT_LUCIDE_OPTIONS = Object.keys(TAG_LANE_ACCENT_ICONS) as TagLaneAccentLucideKey[];

export function renderTagLaneAccentIcon(
  key: string | undefined,
  className?: string
): ReactNode {
  if (!key) return null;
  const Cmp = TAG_LANE_ACCENT_ICONS[key];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}

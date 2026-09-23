'use client';

import { cn } from '@/lib/utils';
import type { MerlinLocation } from '@/types/locations';

type Props = {
  locations: MerlinLocation[];
  currentKey: string | null;
  onChange: (key: string | null) => void;
  className?: string;
};

// "All / Home / Studio". All (null) shows everything and clears Merlin's
// location — it is a filter, and the default. Nothing when Merlin has none.
export function LocationSwitcher({ locations, currentKey, onChange, className }: Props) {
  if (locations.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5" role="group" aria-label="Location">
        {[{ key: null as string | null, label: 'All', emoji: null as string | null }, ...locations].map(loc => (
          <button
            key={loc.key ?? '__all'}
            type="button"
            aria-pressed={currentKey === loc.key}
            onClick={() => currentKey !== loc.key && onChange(loc.key)}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-colors',
              currentKey === loc.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {loc.emoji ? `${loc.emoji} ` : ''}{loc.label}
          </button>
        ))}
      </div>
    </div>
  );
}

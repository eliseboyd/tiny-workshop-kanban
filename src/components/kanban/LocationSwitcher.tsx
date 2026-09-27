'use client';

import { cn } from '@/lib/utils';
import type { MerlinLocation } from '@/types/locations';
import styles from './LocationSwitcher.module.css';

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
    <div className={cn(styles.Root, className)}>
      <div className={styles.Group} role="group" aria-label="Location">
        {[{ key: null as string | null, label: 'All', emoji: null as string | null }, ...locations].map(loc => (
          <button
            key={loc.key ?? '__all'}
            type="button"
            aria-pressed={currentKey === loc.key}
            onClick={() => currentKey !== loc.key && onChange(loc.key)}
            className={cn(
              styles.Option,
              currentKey === loc.key
                ? styles.OptionActive
                : styles.OptionInactive
            )}
          >
            {loc.emoji ? `${loc.emoji} ` : ''}{loc.label}
          </button>
        ))}
      </div>
    </div>
  );
}

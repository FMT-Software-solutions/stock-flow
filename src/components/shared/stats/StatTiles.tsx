import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TONES } from '@/lib/statTones';
import type { StatTile } from '@/types/stats';

/** A row of figures, the same tiles as the dashboard's. Clickable tiles filter the page's table. */
export function StatTiles({ tiles, footnote }: { tiles: StatTile[]; footnote?: ReactNode }) {
  const shown = tiles.filter((t) => !t.hidden);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] [&>*]:min-w-0">
        {shown.map((t) => {
          const body = (
            <>
              <span className="text-[13px] text-muted-foreground">{t.label}</span>
              <span className={cn('truncate text-xl font-bold tabular-nums tracking-tight 2xl:text-2xl', t.valueTone && TONES[t.valueTone])}>
                {t.value}
              </span>
              <span className={cn('min-h-4 text-xs font-medium', t.subTone ? TONES[t.subTone] : 'text-muted-foreground')}>
                {t.sub}
              </span>
            </>
          );
          const base = 'flex flex-col gap-1 rounded-xl border bg-card p-4 text-left';
          return t.onClick ? (
            <button
              key={t.id}
              type="button"
              onClick={t.onClick}
              aria-pressed={t.active}
              className={cn(
                base,
                'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                t.active && 'border-primary ring-1 ring-primary'
              )}
            >
              {body}
            </button>
          ) : (
            <div key={t.id} className={base}>
              {body}
            </div>
          );
        })}
      </div>
      {footnote && <p className="px-1 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

// Pure-markup skeleton shared by app/loading.tsx (streamed while server data
// loads) and KanbanBoardClient (shown while the board chunk loads).
// No 'use client' — usable from both server and client components.
import styles from "./KanbanSkeleton.module.css";

export function KanbanSkeleton() {
  return (
    <div className={styles.Root}>
      {/* Header */}
      <div className={styles.Header}>
        <div className={styles.HeaderTitle} />
        <div className={styles.HeaderActions}>
          <div className={styles.HeaderButton} />
          <div className={styles.HeaderButton} />
        </div>
      </div>
      {/* Tabs */}
      <div className={styles.Tabs}>
        {[120, 100, 80, 70, 90, 100].map((w, i) => (
          <div key={i} className={styles.Tab} style={{ width: w }} />
        ))}
      </div>
      {/* Toolbar */}
      <div className={styles.Toolbar}>
        <div className={styles.ToolbarButton} />
        <div className={styles.ToolbarButton} />
      </div>
      {/* Columns — widths mirror KanbanColumn (w-[85vw] on mobile, w-60 on
          desktop) so the real board lands without layout shift. */}
      <div className={styles.Columns}>
        {[3, 2, 4, 1].map((cardCount, i) => (
          <div key={i} className={styles.Column}>
            <div className={styles.ColumnTitle} />
            {Array.from({ length: cardCount }).map((_, j) => (
              <div key={j} className={styles.Card} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

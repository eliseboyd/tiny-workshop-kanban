import { KanbanSkeleton } from '@/components/kanban/KanbanSkeleton';

// Streamed immediately by Next.js while the page's Supabase queries run,
// so mobile users see the skeleton instead of a blank screen during TTFB.
export default function Loading() {
  return <KanbanSkeleton />;
}

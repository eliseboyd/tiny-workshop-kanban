// A to-do on a board project: a row in Merlin's public.items whose
// kanban_card_id is this card (merlin/docs/project-todos.md). Mapped from the
// snake_case row in src/app/merlin-actions.ts and nowhere else.
export type Todo = {
  id: string;
  title: string;
  status: 'open' | 'done';
  dueAt: string | null;
  estimatedMinutes: number | null;
  contexts: string[];
  score: number | null;
  completedAt: string | null;
  createdAt: string;
};

// A to-do typed here that Merlin has not filed yet: a captures row still
// pending or enriching. Shown greyed so the add feels immediate and honest.
export type FilingTodo = {
  captureId: string;
  text: string;
};

export type CardTodos = {
  configured: boolean;
  open: Todo[];
  done: Todo[];
  filing: FilingTodo[];
};

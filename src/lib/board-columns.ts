/**
 * Shared column title heuristics for dashboard widgets and board logic.
 * Keep in sync with server-side completion flows where relevant.
 */

export type BoardColumn = { id: string; title: string; order: number };

/** Done-style lanes; avoids treating "Incomplete" as done. */
export function findDoneColumn(columns: BoardColumn[]): BoardColumn | undefined {
  return columns.find((c) => {
    const x = c.title.toLowerCase().trim();
    if (x.includes('incomplete')) return false;
    if (/\bdone\b/.test(x) || x.includes('completed')) return true;
    return x.includes('complete');
  });
}

function titleNorm(c: { title: string }) {
  return c.title.toLowerCase().trim();
}

function isInProgressTitle(title: string) {
  const x = titleNorm({ title });
  return (
    x === 'in progress' ||
    x === 'in-progress' ||
    x === 'doing' ||
    x === 'working' ||
    x.includes('in progress')
  );
}

function isTodoTitle(title: string) {
  const x = titleNorm({ title });
  return (
    x === 'to do' ||
    x === 'todo' ||
    x === 'backlog' ||
    x === 'not started' ||
    x === 'planned' ||
    x.includes('to do') ||
    x.endsWith(' todo')
  );
}

export type WorkflowLanes = {
  doneColumn: BoardColumn | undefined;
  todoColumn: BoardColumn;
  inProgressColumn: BoardColumn;
};

/**
 * Resolves todo + in-progress columns for lane widgets.
 * Falls back to first two non-done columns by `order` when titles don't match.
 */
export function resolveWorkflowLanes(columns: BoardColumn[]): WorkflowLanes | null {
  if (!columns.length) return null;

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const doneColumn = findDoneColumn(sorted);
  const nonDone = sorted.filter((c) => !doneColumn || c.id !== doneColumn.id);

  if (nonDone.length === 0) return null;

  let inProgressColumn = nonDone.find((c) => isInProgressTitle(c.title));
  let todoColumn = nonDone.find((c) => isTodoTitle(c.title));

  if (!todoColumn && !inProgressColumn && nonDone.length >= 2) {
    todoColumn = nonDone[0];
    inProgressColumn = nonDone[1];
  } else if (!todoColumn && inProgressColumn) {
    todoColumn = nonDone.find((c) => c.id !== inProgressColumn!.id) ?? nonDone[0];
  } else if (todoColumn && !inProgressColumn) {
    inProgressColumn = nonDone.find((c) => c.id !== todoColumn!.id) ?? nonDone[0];
  } else if (!todoColumn && !inProgressColumn) {
    todoColumn = nonDone[0];
    inProgressColumn = nonDone[0];
  }

  if (todoColumn!.id === inProgressColumn!.id && nonDone.length >= 2) {
    inProgressColumn = nonDone.find((c) => c.id !== todoColumn!.id) ?? nonDone[1];
  }

  return {
    doneColumn,
    todoColumn: todoColumn!,
    inProgressColumn: inProgressColumn!,
  };
}

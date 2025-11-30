export type ProjectStatus = 'todo' | 'in-progress' | 'done';

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  order: number;
  created_at?: string;
}

export const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];




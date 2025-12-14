import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  richContent: text('rich_content'),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('todo'), // todo, in-progress, done
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  tags: text('tags').array(), 
  attachments: jsonb('attachments').$type<{ id: string; url: string; name: string; type: string; size: number }[]>().default([]),
  parentProjectId: text('parent_project_id'), // For grouping cards under a project
});

export const columns = pgTable('columns', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  order: integer('order').notNull().default(0),
});

export const settings = pgTable('settings', {
  id: text('id').primaryKey(), // singleton, e.g., 'default'
  aiPromptTemplate: text('ai_prompt_template').notNull().default('A professional, modern project cover image for a project named "{title}". Abstract, minimal, geometric shapes, soft lighting.'),
  boardTitle: text('board_title').notNull().default('Project Board'),
  // Deprecated but kept to avoid data loss prompt during dev - mapped to text
  todoColTitle: text('todo_col_title').notNull().default('Todo'),
  inProgressColTitle: text('in_progress_col_title').notNull().default('In Progress'),
  doneColTitle: text('done_col_title').notNull().default('Done'),
  cardSize: text('card_size').notNull().default('medium'), // compact, small, medium
  visibleProjects: text('visible_projects').array().default([]), // Which project groups are visible by default
  visibleTags: text('visible_tags').array().default([]), // Which tags are visible by default
  hiddenProjects: text('hidden_projects').array().default([]), // Which project groups are hidden
  hiddenTags: text('hidden_tags').array().default([]), // Which tags are hidden
});

export const tags = pgTable('tags', {
  name: text('name').primaryKey(),
  color: text('color').notNull().default('#64748b'),
  emoji: text('emoji'),
  icon: text('icon'),
});

export const projectGroups = pgTable('project_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#64748b'),
  emoji: text('emoji'),
  icon: text('icon'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

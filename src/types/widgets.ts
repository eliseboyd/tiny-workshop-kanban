// Dashboard Widget Types

export type WidgetType = 'todo-list' | 'materials-shopping';

export interface BaseWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: number;
  createdAt: Date;
}

export interface TodoListWidget extends BaseWidget {
  type: 'todo-list';
  config: {
    filterType: 'tag' | 'project-group';
    filterId: string; // tag name or project group id
    showCompleted: boolean;
  };
}

export interface MaterialsShoppingWidget extends BaseWidget {
  type: 'materials-shopping';
  config: {
    filterType: 'all' | 'tag' | 'project-group';
    filterId?: string; // optional - if filterType is 'all', this is ignored
    showPurchased: boolean;
  };
}

export type DashboardWidget = TodoListWidget | MaterialsShoppingWidget;

// Widget data types for rendering
export interface TodoItem {
  projectId: string;
  projectTitle: string;
  status: string;
  tags: string[];
  parentProjectId?: string | null;
}

export interface MaterialItem {
  id: string;
  text: string;
  toBuy: boolean;
  toBuild: boolean; // "purchased/completed" status
  projectId: string;
  projectTitle: string;
  projectTags: string[];
  parentProjectId?: string | null;
}



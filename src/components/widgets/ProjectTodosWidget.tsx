'use client';

import { useState, useMemo, useRef } from 'react';
import { ListChecks, Check, Circle, Settings2, ExternalLink, Plus, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateProject, moveProjectFromDoneIfNeeded } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Project } from '@/components/kanban/KanbanBoard';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';

type ProjectTodosWidgetProps = {
  widget: {
    id: string;
    title: string;
    config: {
      projectId: string;
      showCompleted: boolean;
    };
  };
  projects: Project[];
  onEdit: () => void;
  onProjectClick: (project: Project) => void;
  onRefresh?: () => void;
};

type TodoItem = {
  text: string;
  checked: boolean;
  index: number; // Position in the HTML for updating
};

// Parse task items from TipTap HTML
function parseTodosFromHtml(html: string): TodoItem[] {
  if (!html) return [];
  
  const todos: TodoItem[] = [];
  
  const taskItemPattern = /<li\s+[^>]*?data-type=["']taskItem["'][^>]*?>/gi;
  const matches: { startIndex: number; attributes: string }[] = [];
  
  let taskMatch;
  while ((taskMatch = taskItemPattern.exec(html)) !== null) {
    matches.push({
      startIndex: taskMatch.index,
      attributes: taskMatch[0]
    });
  }
  
  matches.forEach((match, index) => {
    const startTag = match.attributes;
    const startIndex = match.startIndex + startTag.length;
    
    let depth = 1;
    let endIndex = startIndex;
    let i = startIndex;
    
    while (i < html.length && depth > 0) {
      if (html.slice(i, i + 4).toLowerCase() === '<li ' || html.slice(i, i + 3).toLowerCase() === '<li>') {
        depth++;
      } else if (html.slice(i, i + 5).toLowerCase() === '</li>') {
        depth--;
        if (depth === 0) {
          endIndex = i;
        }
      }
      i++;
    }
    
    const content = html.slice(startIndex, endIndex);
    
    const checkedMatch = startTag.match(/data-checked=["']?(true|false)["']?/i);
    const checked = checkedMatch ? checkedMatch[1].toLowerCase() === 'true' : false;
    
    let text = content
      .replace(/<label[^>]*>[\s\S]*?<\/label>/gi, '')
      .replace(/<input[^>]*\/?>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (text) {
      todos.push({ text, checked, index });
    }
  });
  
  return todos;
}

// Update a specific todo's checked state in the HTML
function updateTodoCheckedInHtml(html: string, todoIndex: number, newChecked: boolean): string {
  let currentIndex = 0;
  
  return html.replace(
    /<li\s+([^>]*?data-type=["']taskItem["'][^>]*?)>/gi,
    (match, attributes) => {
      if (currentIndex === todoIndex) {
        currentIndex++;
        if (attributes.includes('data-checked=')) {
          const newAttrs = attributes.replace(
            /data-checked=["']?(true|false)["']?/i,
            `data-checked="${newChecked}"`
          );
          return `<li ${newAttrs}>`;
        } else {
          return `<li ${attributes} data-checked="${newChecked}">`;
        }
      }
      currentIndex++;
      return match;
    }
  );
}

// Add a new todo to the HTML (creates or appends to task list)
function addTodoToHtml(html: string, text: string): string {
  const newTaskItem = `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${text}</p></div></li>`;
  
  // Check if there's already a task list
  const taskListMatch = html.match(/<ul\s+[^>]*?data-type=["']taskList["'][^>]*?>/i);
  
  if (taskListMatch) {
    // Find the closing </ul> of the task list and insert before it
    const taskListStart = html.indexOf(taskListMatch[0]);
    let depth = 1;
    let i = taskListStart + taskListMatch[0].length;
    
    while (i < html.length && depth > 0) {
      if (html.slice(i, i + 3).toLowerCase() === '<ul') {
        depth++;
      } else if (html.slice(i, i + 5).toLowerCase() === '</ul>') {
        depth--;
        if (depth === 0) {
          // Insert before this </ul>
          return html.slice(0, i) + newTaskItem + html.slice(i);
        }
      }
      i++;
    }
  }
  
  // No task list exists, create one
  const newTaskList = `<ul data-type="taskList">${newTaskItem}</ul>`;
  
  // Append to the end of the content
  if (html) {
    return html + newTaskList;
  }
  return newTaskList;
}

// Delete a todo from the HTML
function deleteTodoFromHtml(html: string, todoIndex: number): string {
  let currentIndex = 0;
  
  // Find and remove the specific task item
  return html.replace(
    /<li\s+[^>]*?data-type=["']taskItem["'][^>]*?>[\s\S]*?<\/li>/gi,
    (match) => {
      if (currentIndex === todoIndex) {
        currentIndex++;
        return ''; // Remove this item
      }
      currentIndex++;
      return match;
    }
  );
}

// Update a todo's text in the HTML
function updateTodoTextInHtml(html: string, todoIndex: number, newText: string): string {
  let currentIndex = 0;
  
  return html.replace(
    /(<li\s+[^>]*?data-type=["']taskItem["'][^>]*?>)([\s\S]*?)(<\/li>)/gi,
    (match, openTag, content, closeTag) => {
      if (currentIndex === todoIndex) {
        currentIndex++;
        // Replace the text content while preserving structure
        // The content has <label>...</label><div><p>TEXT</p></div>
        const newContent = content.replace(
          /(<div[^>]*>)\s*<p[^>]*>[\s\S]*?<\/p>\s*(<\/div>)/i,
          `$1<p>${newText}</p>$2`
        );
        return openTag + newContent + closeTag;
      }
      currentIndex++;
      return match;
    }
  );
}

export function ProjectTodosWidget({
  widget,
  projects,
  onEdit,
  onProjectClick,
  onRefresh,
}: ProjectTodosWidgetProps) {
  const router = useRouter();
  const dragListeners = useDragHandle();
  const [newTodoText, setNewTodoText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Find the project
  const project = useMemo(() => 
    projects.find(p => p.id === widget.config.projectId),
    [projects, widget.config.projectId]
  );

  // Parse todos from project's rich content
  const allTodos = useMemo(() => {
    if (!project?.richContent) return [];
    return parseTodosFromHtml(project.richContent);
  }, [project?.richContent]);

  // Filter based on showCompleted setting
  const displayTodos = useMemo(() => {
    if (widget.config.showCompleted) return allTodos;
    return allTodos.filter(todo => !todo.checked);
  }, [allTodos, widget.config.showCompleted]);

  // Track project as recently opened
  const trackRecentProject = (projectId: string) => {
    try {
      const recent = localStorage.getItem('recentProjects');
      const recentIds = recent ? JSON.parse(recent) : [];
      const updated = [projectId, ...recentIds.filter((id: string) => id !== projectId)].slice(0, 10);
      localStorage.setItem('recentProjects', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to track recent project:', error);
    }
  };

  const handleProjectClick = (project: Project) => {
    trackRecentProject(project.id);
    onProjectClick(project);
  };

  const handleToggleTodo = async (todo: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project?.richContent) return;
    
    const updatedHtml = updateTodoCheckedInHtml(project.richContent, todo.index, !todo.checked);
    await updateProject(project.id, { richContent: updatedHtml });
    router.refresh();
    onRefresh?.();
  };

  const handleAddTodo = async () => {
    if (!newTodoText.trim() || !project) return;
    
    const currentHtml = project.richContent || '';
    const updatedHtml = addTodoToHtml(currentHtml, newTodoText.trim());
    await updateProject(project.id, { richContent: updatedHtml });
    
    // Move project from Done if it was completed
    await moveProjectFromDoneIfNeeded(project.id);
    
    setNewTodoText('');
    router.refresh();
    onRefresh?.();
  };

  const handleDeleteTodo = async (todo: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project?.richContent) return;
    
    const updatedHtml = deleteTodoFromHtml(project.richContent, todo.index);
    await updateProject(project.id, { richContent: updatedHtml });
    router.refresh();
    onRefresh?.();
  };

  const handleStartEdit = (todo: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIndex(todo.index);
    setEditText(todo.text);
  };

  const handleSaveEdit = async (todo: TodoItem) => {
    if (!editText.trim() || !project?.richContent) {
      setEditingIndex(null);
      return;
    }
    
    const updatedHtml = updateTodoTextInHtml(project.richContent, todo.index, editText.trim());
    await updateProject(project.id, { richContent: updatedHtml });
    setEditingIndex(null);
    router.refresh();
    onRefresh?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent, todo?: TodoItem) => {
    if (e.key === 'Enter') {
      if (todo) {
        handleSaveEdit(todo);
      } else {
        handleAddTodo();
      }
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
      setNewTodoText('');
    }
  };

  if (!project) {
    return (
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden group">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-600" />
            <h3 className="font-semibold text-sm">{widget.title}</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <p className="text-sm">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden group flex flex-col h-full">
      {/* Header - draggable */}
      <div 
        className="px-4 py-3 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10 flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...dragListeners}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="h-4 w-4 text-violet-600 flex-shrink-0" />
            <h3 className="font-semibold text-sm truncate">{widget.title}</h3>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => handleProjectClick(project)}
              title="Open project"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit} title="Widget settings">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          Tasks from "{project.title}"
        </p>
      </div>

      {/* Items */}
      <ScrollFade>
        {displayTodos.length === 0 && !newTodoText ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">
              {allTodos.length === 0 
                ? 'No tasks yet' 
                : 'All tasks completed!'
              }
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {displayTodos.map((todo, idx) => (
              <li 
                key={`${todo.index}-${idx}`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors group/item",
                  todo.checked && "bg-muted/20"
                )}
              >
                <button 
                  className="flex-shrink-0 focus:outline-none"
                  onClick={(e) => handleToggleTodo(todo, e)}
                >
                  {todo.checked ? (
                    <Check className="h-4 w-4 text-violet-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground hover:text-violet-600 transition-colors" />
                  )}
                </button>
                
                {editingIndex === todo.index ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, todo)}
                    onBlur={() => handleSaveEdit(todo)}
                    autoFocus
                    className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 p-0"
                  />
                ) : (
                  <span 
                    className={cn(
                      "flex-1 text-sm cursor-pointer",
                      todo.checked && "line-through text-muted-foreground"
                    )}
                    onDoubleClick={(e) => handleStartEdit(todo, e)}
                  >
                    {todo.text}
                  </span>
                )}
                
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleStartEdit(todo, e)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteTodo(todo, e)}
                    className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>

      {/* Add Todo Input */}
      <div className="border-t bg-muted/10 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            placeholder="Add a task..."
            className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
    </div>
  );
}

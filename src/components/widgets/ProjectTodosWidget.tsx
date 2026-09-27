'use client';

import { useState, useMemo, useRef } from 'react';
import { ListChecks, Check, Circle, Settings2, ExternalLink, Plus, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateProject, moveProjectFromDoneIfNeeded } from '@/app/actions';
import type { Project } from '@/components/kanban/KanbanBoard';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';
import styles from './ProjectTodosWidget.module.css';

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
    
    const text = content
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
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
    onRefresh?.();
  };

  const handleDeleteTodo = async (todo: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project?.richContent) return;
    
    const updatedHtml = deleteTodoFromHtml(project.richContent, todo.index);
    await updateProject(project.id, { richContent: updatedHtml });
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
      <div className={styles.Card}>
        <div className={styles.NotFoundHeader}>
          <div className={styles.TitleGroup}>
            <ListChecks className={styles.TitleIcon} />
            <h3 className={styles.Title}>{widget.title}</h3>
          </div>
          <Button variant="ghost" size="sm" className={styles.IconButton} onClick={onEdit}>
            <Settings2 className={styles.ButtonIcon} />
          </Button>
        </div>
        <div className={styles.NotFound}>
          <p className={styles.Message}>Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(styles.Card, styles.Fill)}>
      {/* Header - draggable */}
      <div 
        className={styles.Header}
        {...dragListeners}
      >
        <div className={styles.HeaderRow}>
          <div className={styles.HeaderTitleGroup}>
            <ListChecks className={styles.HeaderIcon} />
            <h3 className={styles.HeaderTitle}>{widget.title}</h3>
          </div>
          <div className={styles.HeaderActions}>
            <Button
              variant="ghost"
              size="sm"
              className={styles.IconButton}
              onClick={() => handleProjectClick(project)}
              title="Open project"
            >
              <ExternalLink className={styles.ButtonIcon} />
            </Button>
            <Button variant="ghost" size="sm" className={styles.IconButton} onClick={onEdit} title="Widget settings">
              <Settings2 className={styles.ButtonIcon} />
            </Button>
          </div>
        </div>
        <p className={styles.Subtitle}>
          Tasks from &quot;{project.title}&quot;
        </p>
      </div>

      {/* Items */}
      <ScrollFade>
        {displayTodos.length === 0 && !newTodoText ? (
          <div className={styles.Empty}>
            <p className={styles.Message}>
              {allTodos.length === 0 
                ? 'No tasks yet' 
                : 'All tasks completed!'
              }
            </p>
          </div>
        ) : (
          <ul className={styles.List}>
            {displayTodos.map((todo, idx) => (
              <li 
                key={`${todo.index}-${idx}`}
                className={cn(styles.Item, todo.checked && styles.ItemChecked)}
              >
                <button 
                  className={styles.Toggle}
                  onClick={(e) => handleToggleTodo(todo, e)}
                >
                  {todo.checked ? (
                    <Check className={styles.CheckIcon} />
                  ) : (
                    <Circle className={styles.CircleIcon} />
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
                    className={styles.EditInput}
                  />
                ) : (
                  <span 
                    className={cn(styles.ItemText, todo.checked && styles.ItemTextChecked)}
                    onDoubleClick={(e) => handleStartEdit(todo, e)}
                  >
                    {todo.text}
                  </span>
                )}
                
                <div className={styles.ItemActions}>
                  <button
                    onClick={(e) => handleStartEdit(todo, e)}
                    className={styles.EditButton}
                    title="Edit"
                  >
                    <Pencil className={styles.ActionIcon} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteTodo(todo, e)}
                    className={styles.DeleteButton}
                    title="Delete"
                  >
                    <X className={styles.ActionIcon} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>

      {/* Add Todo Input */}
      <div className={styles.AddBar}>
        <div className={styles.AddRow}>
          <Plus className={styles.AddIcon} />
          <input
            ref={inputRef}
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            placeholder="Add a task..."
            className={styles.AddInput}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ListTodo, ShoppingCart, Tags, FolderKanban, ListChecks, Trash2, Calendar, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createWidget, updateWidget, deleteWidget } from '@/app/actions';
import { useRouter } from 'next/navigation';

type Tag = {
  name: string;
  color: string;
  emoji?: string;
};

type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
};

type Project = {
  id: string;
  title: string;
};

type WidgetConfig = {
  id?: string;
  type: 'todo-list' | 'materials-shopping' | 'project-todos' | 'day-plan' | 'active-projects';
  title: string;
  config: Record<string, any>;
};

type AddWidgetDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  projectGroups: ProjectGroup[];
  projects?: Project[];
  editingWidget?: WidgetConfig | null;
};

type WidgetType = 'todo-list' | 'materials-shopping' | 'project-todos' | 'day-plan' | 'active-projects';

const WIDGET_TYPES = [
  {
    id: 'todo-list' as WidgetType,
    name: 'Group of Projects',
    description: 'Filter by tags, project groups, or all projects',
    icon: ListTodo,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  {
    id: 'active-projects' as WidgetType,
    name: 'Active Projects List',
    description: 'All active projects/tasks with advanced filtering',
    icon: Layers,
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  },
  {
    id: 'materials-shopping' as WidgetType,
    name: 'Shopping List',
    description: 'Show materials marked "To Buy"',
    icon: ShoppingCart,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  {
    id: 'project-todos' as WidgetType,
    name: 'Single Project',
    description: 'Show all tasks from a project',
    icon: ListChecks,
    color: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  },
  {
    id: 'day-plan' as WidgetType,
    name: 'Day Plan',
    description: 'Drag projects here to plan your day',
    icon: Calendar,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  },
];

export function AddWidgetDialog({
  isOpen,
  onClose,
  tags,
  projectGroups,
  projects = [],
  editingWidget,
}: AddWidgetDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<'type' | 'config'>(editingWidget ? 'config' : 'type');
  const [selectedType, setSelectedType] = useState<WidgetType | null>(
    editingWidget?.type || null
  );
  const [title, setTitle] = useState(editingWidget?.title || '');
  const [filterType, setFilterType] = useState<'all' | 'tag' | 'project-group'>(
    editingWidget?.config?.filterType || 'tag'
  );
  const [filterId, setFilterId] = useState<string>(
    editingWidget?.config?.filterId || ''
  );
  const [projectId, setProjectId] = useState<string>(
    editingWidget?.config?.projectId || ''
  );
  const [showCompleted, setShowCompleted] = useState(
    editingWidget?.config?.showCompleted ?? false
  );
  const [showPurchased, setShowPurchased] = useState(
    editingWidget?.config?.showPurchased ?? false
  );
  const [showType, setShowType] = useState<'all' | 'projects' | 'tasks'>(
    editingWidget?.config?.showType || 'all'
  );
  const [colSpan, setColSpan] = useState<1 | 2 | 3>(
    editingWidget?.config?.colSpan || 1
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state when editingWidget changes (e.g., opening dialog to edit)
  useEffect(() => {
    if (isOpen) {
      if (editingWidget) {
        setStep('config');
        setSelectedType(editingWidget.type);
        setTitle(editingWidget.title || '');
        setFilterType(editingWidget.config?.filterType || 'tag');
        setFilterId(editingWidget.config?.filterId || '');
        setProjectId(editingWidget.config?.projectId || '');
        setShowCompleted(editingWidget.config?.showCompleted ?? false);
        setShowPurchased(editingWidget.config?.showPurchased ?? false);
        setShowType(editingWidget.config?.showType || 'all');
        setColSpan(editingWidget.config?.colSpan || 1);
      } else {
        // New widget - reset to type selection
        setStep('type');
        setSelectedType(null);
        setTitle('');
        setFilterType('tag');
        setFilterId('');
        setProjectId('');
        setShowCompleted(false);
        setShowPurchased(false);
        setShowType('all');
        setColSpan(1);
      }
    }
  }, [isOpen, editingWidget]);

  const handleSelectType = (type: WidgetType) => {
    setSelectedType(type);
    // Set default title based on type
    if (!title) {
      if (type === 'todo-list') setTitle('My Tasks');
      else if (type === 'materials-shopping') setTitle('Shopping List');
      else if (type === 'project-todos') setTitle('Project Tasks');
      else if (type === 'day-plan') setTitle('Day Plan');
      else if (type === 'active-projects') setTitle('Active Projects');
    }
    // For materials, default to 'all'
    if (type === 'materials-shopping') {
      setFilterType('all');
    }
    // Day plan doesn't need config - create directly
    if (type === 'day-plan') {
      setStep('config'); // Still go to config for title editing
    } else {
      setStep('config');
    }
  };

  const handleBack = () => {
    if (editingWidget) {
      onClose();
    } else {
      setStep('type');
    }
  };

  const handleSave = async () => {
    if (!selectedType || !title.trim()) return;

    // Validate filter selection for todo-list
    if (selectedType === 'todo-list' && filterType !== 'all' && !filterId) {
      return;
    }
    
    // Validate project selection for project-todos
    if (selectedType === 'project-todos' && !projectId) {
      return;
    }

    setIsSaving(true);

    try {
      const config: Record<string, any> = {
        colSpan, // Include width in all widget configs
      };
      
      if (selectedType === 'todo-list') {
        config.filterType = filterType;
        if (filterType !== 'all') {
          config.filterId = filterId;
        }
        config.showCompleted = showCompleted;
      } else if (selectedType === 'materials-shopping') {
        config.filterType = filterType;
        if (filterType !== 'all') {
          config.filterId = filterId;
        }
        config.showPurchased = showPurchased;
      } else if (selectedType === 'project-todos') {
        config.projectId = projectId;
        config.showCompleted = showCompleted;
      } else if (selectedType === 'active-projects') {
        config.showType = showType;
      }

      if (editingWidget?.id) {
        await updateWidget(editingWidget.id, {
          title: title.trim(),
          config,
        });
      } else {
        await createWidget({
          type: selectedType,
          title: title.trim(),
          config,
        });
      }

      router.refresh();
      handleClose();
    } catch (error) {
      console.error('Failed to save widget:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setStep('type');
    setSelectedType(null);
    setTitle('');
    setFilterType('tag');
    setFilterId('');
    setProjectId('');
    setShowCompleted(false);
    setShowPurchased(false);
    setShowType('all');
    setColSpan(1);
    onClose();
  };

  const handleDelete = async () => {
    if (!editingWidget?.id) return;
    
    if (confirm('Delete this widget?')) {
      setIsDeleting(true);
      try {
        await deleteWidget(editingWidget.id);
        router.refresh();
        handleClose();
      } catch (error) {
        console.error('Failed to delete widget:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const canSave = () => {
    if (!selectedType || !title.trim()) return false;
    if (selectedType === 'todo-list' && !filterId) return false;
    if (selectedType === 'materials-shopping' && filterType !== 'all' && !filterId) return false;
    if (selectedType === 'project-todos' && !projectId) return false;
    if (selectedType === 'day-plan') return true; // Day plan doesn't need config
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingWidget ? 'Edit Widget' : step === 'type' ? 'Add Widget' : 'Configure Widget'}
          </DialogTitle>
          <DialogDescription>
            {step === 'type' 
              ? 'Choose a widget type to add to your dashboard'
              : 'Configure your widget settings'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'type' ? (
          /* Type Selection */
          <div className="grid gap-3 py-4">
            {WIDGET_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleSelectType(type.id)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02]",
                  type.color,
                  "hover:border-current"
                )}
              >
                <div className="p-2 rounded-lg bg-background/50">
                  <type.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold">{type.name}</h4>
                  <p className="text-sm opacity-80">{type.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Configuration */
          <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="widget-title">Widget Title</Label>
              <Input
                id="widget-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter widget title..."
              />
            </div>

            {/* Day Plan Description */}
            {selectedType === 'day-plan' && (
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground text-center">
                  Drag project cards from the Kanban board onto this widget to plan your day
                </p>
              </div>
            )}

            {/* Active Projects Type Selection */}
            {selectedType === 'active-projects' && (
              <div className="space-y-2">
                <Label>Show</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={showType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowType('all')}
                    className="flex-1"
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant={showType === 'projects' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowType('projects')}
                    className="flex-1 gap-2"
                  >
                    <FolderKanban className="h-4 w-4" />
                    Projects
                  </Button>
                  <Button
                    type="button"
                    variant={showType === 'tasks' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowType('tasks')}
                    className="flex-1 gap-2"
                  >
                    <ListTodo className="h-4 w-4" />
                    Tasks
                  </Button>
                </div>
              </div>
            )}

            {/* Project Selection (for project-todos) */}
            {selectedType === 'project-todos' && (
              <div className="space-y-2">
                <Label>Select Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No projects available
                      </div>
                    ) : (
                      projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filter Type (for todo-list and materials-shopping) */}
            {(selectedType === 'todo-list' || selectedType === 'materials-shopping') && (
              <div className="space-y-2">
                <Label>Filter By</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={filterType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('all')}
                    className="flex-1"
                  >
                    All Projects
                  </Button>
                  <Button
                    type="button"
                    variant={filterType === 'tag' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('tag')}
                    className="flex-1 gap-2"
                  >
                    <Tags className="h-4 w-4" />
                    Tag
                  </Button>
                  <Button
                    type="button"
                    variant={filterType === 'project-group' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('project-group')}
                    className="flex-1 gap-2"
                  >
                    <FolderKanban className="h-4 w-4" />
                    Project Group
                  </Button>
                </div>
              </div>
            )}

            {/* Filter Selection (for todo-list and materials-shopping) */}
            {(selectedType === 'todo-list' || selectedType === 'materials-shopping') && filterType !== 'all' && (
              <div className="space-y-2">
                <Label>
                  {filterType === 'tag' ? 'Select Tag' : 'Select Project Group'}
                </Label>
                <Select value={filterId} onValueChange={setFilterId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Choose a ${filterType === 'tag' ? 'tag' : 'project group'}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {filterType === 'tag' ? (
                      tags.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No tags available
                        </div>
                      ) : (
                        tags.map((tag) => (
                          <SelectItem key={tag.name} value={tag.name}>
                            <div className="flex items-center gap-2">
                              {tag.emoji && <span>{tag.emoji}</span>}
                              <span>#{tag.name}</span>
                              <div 
                                className="w-2.5 h-2.5 rounded-full ml-auto" 
                                style={{ backgroundColor: tag.color }}
                              />
                            </div>
                          </SelectItem>
                        ))
                      )
                    ) : (
                      projectGroups.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No project groups available
                        </div>
                      ) : (
                        projectGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            <div className="flex items-center gap-2">
                              {group.emoji && <span>{group.emoji}</span>}
                              <span>{group.name}</span>
                              <div 
                                className="w-2.5 h-2.5 rounded-full ml-auto" 
                                style={{ backgroundColor: group.color }}
                              />
                            </div>
                          </SelectItem>
                        ))
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show Completed/Owned */}
            <div className="flex items-center gap-3 pt-2">
              <Checkbox
                id="show-completed"
                checked={selectedType === 'materials-shopping' ? showPurchased : showCompleted}
                onCheckedChange={(checked) => {
                  if (selectedType === 'materials-shopping') {
                    setShowPurchased(!!checked);
                  } else {
                    setShowCompleted(!!checked);
                  }
                }}
              />
              <Label htmlFor="show-completed" className="cursor-pointer">
                {selectedType === 'materials-shopping' 
                  ? 'Show items already owned'
                  : 'Show completed tasks'
                }
              </Label>
            </div>

            {/* Widget Width */}
            <div className="space-y-2 pt-2 border-t">
              <Label>Width</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setColSpan(1)}
                  className={cn(
                    "flex-1 p-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                    colSpan === 1 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className="w-5 h-4 border-2 rounded" />
                  <span className="text-xs text-muted-foreground">1 col</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColSpan(2)}
                  className={cn(
                    "flex-1 p-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                    colSpan === 2 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className="w-8 h-4 border-2 rounded" />
                  <span className="text-xs text-muted-foreground">2 cols</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColSpan(3)}
                  className={cn(
                    "flex-1 p-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                    colSpan === 3 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className="w-12 h-4 border-2 rounded" />
                  <span className="text-xs text-muted-foreground">3 cols</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Drag the bottom edge of a widget to adjust height</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          {/* Delete button - only when editing */}
          {step === 'config' && editingWidget && (
            <Button 
              variant="ghost" 
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Widget'}
            </Button>
          )}
          
          <div className="flex gap-2 ml-auto">
            {step === 'config' && (
              <Button variant="outline" onClick={handleBack}>
                {editingWidget ? 'Cancel' : 'Back'}
              </Button>
            )}
            {step === 'config' && (
              <Button 
                onClick={handleSave} 
                disabled={!canSave() || isSaving}
              >
                {isSaving ? 'Saving...' : editingWidget ? 'Save Changes' : 'Add Widget'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


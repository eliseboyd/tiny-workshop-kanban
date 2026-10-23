'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ListTodo, ShoppingCart, Tags, FolderKanban, ListChecks, Trash2, Calendar, Layers, LayoutGrid, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './AddWidgetDialog.module.css';
import { TAG_LANE_ACCENT_LUCIDE_OPTIONS } from '@/lib/tag-lane-accent-icons';
import { createWidget, updateWidget, deleteWidget } from '@/app/actions';
import type { MerlinLocation } from '@/types/locations';

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
  type: 'todo-list' | 'materials-shopping' | 'project-todos' | 'day-plan' | 'active-projects' | 'tag-lane-board';
  title: string;
  config: Record<string, unknown>;
  location_key?: string | null;
};

type AddWidgetDialogProps = {
  isOpen: boolean;
  /** Called after save or when closing; may be async (e.g. refetch widgets). */
  onClose: () => void | Promise<void>;
  tags: Tag[];
  projectGroups: ProjectGroup[];
  projects?: Project[];
  editingWidget?: WidgetConfig | null;
  /** Merlin locations; empty hides the "Show at" picker. */
  locations?: MerlinLocation[];
  /** Default for a new widget. */
  currentLocationKey?: string | null;
};

type WidgetType = 'todo-list' | 'materials-shopping' | 'project-todos' | 'day-plan' | 'active-projects' | 'tag-lane-board';

const WIDGET_TYPES = [
  {
    id: 'todo-list' as WidgetType,
    name: 'Group of Projects',
    description: 'Filter by tags, project groups, or all projects',
    icon: ListTodo,
    color: styles.TypeBlue,
  },
  {
    id: 'tag-lane-board' as WidgetType,
    name: 'Tag lane',
    description: 'Visual cards for To do and In progress, filtered by tag or group',
    icon: LayoutGrid,
    color: styles.TypeCyan,
  },
  {
    id: 'active-projects' as WidgetType,
    name: 'Active Projects List',
    description: 'All active projects/tasks with advanced filtering',
    icon: Layers,
    color: styles.TypeIndigo,
  },
  {
    id: 'materials-shopping' as WidgetType,
    name: 'Shopping List',
    description: 'Show materials marked "To Buy"',
    icon: ShoppingCart,
    color: styles.TypeAmber,
  },
  {
    id: 'project-todos' as WidgetType,
    name: 'Single Project',
    description: 'Show all tasks from a project',
    icon: ListChecks,
    color: styles.TypeViolet,
  },
  {
    id: 'day-plan' as WidgetType,
    name: 'Day Plan',
    description: 'Drag projects here to plan your day',
    icon: Calendar,
    color: styles.TypeEmerald,
  },
];

export function AddWidgetDialog({
  isOpen,
  onClose,
  tags,
  projectGroups,
  projects = [],
  editingWidget,
  locations = [],
  currentLocationKey = null,
}: AddWidgetDialogProps) {
  const [step, setStep] = useState<'type' | 'config'>(editingWidget ? 'config' : 'type');
  const [selectedType, setSelectedType] = useState<WidgetType | null>(
    editingWidget?.type || null
  );
  const [title, setTitle] = useState(editingWidget?.title || '');
  const [filterType, setFilterType] = useState<'all' | 'tag' | 'project-group'>(
    (editingWidget?.config?.filterType as 'all' | 'tag' | 'project-group') || 'tag'
  );
  const [filterId, setFilterId] = useState<string>(
    (editingWidget?.config?.filterId as string) || ''
  );
  const [projectId, setProjectId] = useState<string>(
    (editingWidget?.config?.projectId as string) || ''
  );
  const [showCompleted, setShowCompleted] = useState(
    (editingWidget?.config?.showCompleted as boolean) ?? false
  );
  const [showPurchased, setShowPurchased] = useState(
    (editingWidget?.config?.showPurchased as boolean) ?? false
  );
  const [showType, setShowType] = useState<'all' | 'projects' | 'tasks'>(
    (editingWidget?.config?.showType as 'all' | 'projects' | 'tasks') || 'all'
  );
  const [colSpan, setColSpan] = useState<1 | 2 | 3>(
    (editingWidget?.config?.colSpan as 1 | 2 | 3) || 1
  );
  const [boardViewMode, setBoardViewMode] = useState<'cards' | 'mini-kanban'>(
    (editingWidget?.config?.viewMode as 'cards' | 'mini-kanban') || 'cards'
  );
  const [accentHeadline, setAccentHeadline] = useState(
    (editingWidget?.config?.accentHeadline as string) || ''
  );
  const [accentColor, setAccentColor] = useState(
    (editingWidget?.config?.accentColor as string) || ''
  );
  const [accentEmoji, setAccentEmoji] = useState(
    (editingWidget?.config?.accentEmoji as string) || ''
  );
  const [accentLucide, setAccentLucide] = useState(
    (editingWidget?.config?.accentLucide as string) || ''
  );
  // null = shown at every location
  const [locationKey, setLocationKey] = useState<string | null>(
    editingWidget ? editingWidget.location_key ?? null : currentLocationKey
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state when editingWidget changes (e.g., opening dialog to edit)
  useEffect(() => {
    if (isOpen) {
      setSaveError(null);
      if (editingWidget) {
        setStep('config');
        setSelectedType(editingWidget.type);
        setTitle(editingWidget.title || '');
        setFilterType((editingWidget.config?.filterType as 'all' | 'tag' | 'project-group') || 'tag');
        setFilterId((editingWidget.config?.filterId as string) || '');
        setProjectId((editingWidget.config?.projectId as string) || '');
        setShowCompleted((editingWidget.config?.showCompleted as boolean) ?? false);
        setShowPurchased((editingWidget.config?.showPurchased as boolean) ?? false);
        setShowType((editingWidget.config?.showType as 'all' | 'projects' | 'tasks') || 'all');
        setColSpan((editingWidget.config?.colSpan as 1 | 2 | 3) || 1);
        setBoardViewMode((editingWidget.config?.viewMode as 'cards' | 'mini-kanban') || 'cards');
        setAccentHeadline((editingWidget.config?.accentHeadline as string) || '');
        setAccentColor((editingWidget.config?.accentColor as string) || '');
        setAccentEmoji((editingWidget.config?.accentEmoji as string) || '');
        setAccentLucide((editingWidget.config?.accentLucide as string) || '');
        setLocationKey(editingWidget.location_key ?? null);
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
        setBoardViewMode('cards');
        setAccentHeadline('');
        setAccentColor('');
        setAccentEmoji('');
        setAccentLucide('');
        setLocationKey(currentLocationKey);
      }
    }
    // currentLocationKey is only a default for a new widget; it must not reset the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      else if (type === 'tag-lane-board') setTitle('Tag lane');
    }
    if (type === 'tag-lane-board') {
      setFilterType('tag');
      setFilterId('');
      setBoardViewMode('cards');
      setColSpan(1);
      setAccentHeadline('');
      setAccentColor('');
      setAccentEmoji('');
      setAccentLucide('');
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

    if (selectedType === 'tag-lane-board' && !filterId) {
      return;
    }
    
    // Validate project selection for project-todos
    if (selectedType === 'project-todos' && !projectId) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const config: Record<string, unknown> = {
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
      } else if (selectedType === 'tag-lane-board') {
        config.filterType = filterType === 'project-group' ? 'project-group' : 'tag';
        config.filterId = filterId;
        config.viewMode = boardViewMode;
        if (accentHeadline.trim()) config.accentHeadline = accentHeadline.trim();
        if (accentColor.trim()) config.accentColor = accentColor.trim();
        if (accentEmoji.trim()) config.accentEmoji = accentEmoji.trim();
        if (accentLucide.trim()) config.accentLucide = accentLucide.trim();
      }

      const widgetId = editingWidget && 'id' in editingWidget ? (editingWidget as { id: string }).id : undefined;
      if (widgetId) {
        await updateWidget(widgetId, {
          title: title.trim(),
          config,
          locationKey,
        });
      } else {
        await createWidget({
          type: selectedType,
          title: title.trim(),
          config,
          locationKey,
        });
      }

      await handleClose();
    } catch (error) {
      console.error('Failed to save widget:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Could not save widget. Check the database migration for this widget type, then try again.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    setSaveError(null);
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
    setBoardViewMode('cards');
    setAccentHeadline('');
    setAccentColor('');
    setAccentEmoji('');
    setAccentLucide('');
    await Promise.resolve(onClose());
  };

  const handleDelete = async () => {
    if (!editingWidget?.id) return;
    
    if (confirm('Delete this widget?')) {
      setIsDeleting(true);
      try {
        await deleteWidget(editingWidget.id);
        await handleClose();
      } catch (error) {
        console.error('Failed to delete widget:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const canSave = () => {
    if (!selectedType || !title.trim()) return false;
    if (selectedType === 'todo-list' && filterType !== 'all' && !filterId) return false;
    if (selectedType === 'materials-shopping' && filterType !== 'all' && !filterId) return false;
    if (selectedType === 'project-todos' && !projectId) return false;
    if (selectedType === 'tag-lane-board' && !filterId) return false;
    if (selectedType === 'day-plan') return true; // Day plan doesn't need config
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && void handleClose()}>
      <DialogContent className={styles.Content}>
        <div className={styles.HeaderBar}>
          <DialogHeader className={styles.Header}>
            <DialogTitle>
              {editingWidget ? 'Edit Widget' : step === 'type' ? 'Add Widget' : 'Configure Widget'}
            </DialogTitle>
            <DialogDescription>
              {step === 'type'
                ? 'Choose a widget type to add to your dashboard'
                : 'Configure your widget settings'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {step === 'type' ? (
          /* Type Selection */
          <div className={styles.TypeList}>
            {WIDGET_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleSelectType(type.id)}
                className={cn(styles.TypeOption, type.color)}
              >
                <div className={styles.TypeIconWrap}>
                  <type.icon className={styles.TypeIcon} />
                </div>
                <div>
                  <h4 className={styles.TypeName}>{type.name}</h4>
                  <p className={styles.TypeDescription}>{type.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.ConfigBody}>
            <div className={styles.ConfigGrid}>
              <div className={styles.Column}>
            {/* Title */}
            <div className={styles.Field}>
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
              <div className={styles.DayPlanNote}>
                <p className={styles.DayPlanText}>
                  Drag project cards from the Kanban board onto this widget to plan your day
                </p>
              </div>
            )}

            {/* Tag lane: filter + layout (accents in right column) */}
            {selectedType === 'tag-lane-board' && (
              <div className={styles.Stack}>
                <div className={styles.Field}>
                  <Label>Filter by</Label>
                  <div className={styles.ButtonRow}>
                    <Button
                      type="button"
                      variant={filterType === 'tag' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilterType('tag');
                        setFilterId('');
                      }}
                      className={styles.ToggleWithIcon}
                    >
                      <Tags className={styles.ButtonIcon} />
                      Tag
                    </Button>
                    <Button
                      type="button"
                      variant={filterType === 'project-group' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilterType('project-group');
                        setFilterId('');
                      }}
                      className={styles.ToggleWithIcon}
                    >
                      <FolderKanban className={styles.ButtonIcon} />
                      Group
                    </Button>
                  </div>
                </div>
                <div className={styles.Field}>
                  <Label>{filterType === 'tag' ? 'Tag' : 'Project group'}</Label>
                  <Select value={filterId || undefined} onValueChange={setFilterId}>
                    <SelectTrigger>
                      <SelectValue placeholder={filterType === 'tag' ? 'Choose a tag…' : 'Choose a group…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filterType === 'tag' ? (
                        tags.length === 0 ? (
                          <div className={styles.Empty}>No tags</div>
                        ) : (
                          tags.map((tag) => (
                            <SelectItem key={tag.name} value={tag.name}>
                              <div className={styles.OptionRow}>
                                {tag.emoji && <span>{tag.emoji}</span>}
                                <span>#{tag.name}</span>
                                <div
                                  className={styles.Dot}
                                  style={{ backgroundColor: tag.color }}
                                />
                              </div>
                            </SelectItem>
                          ))
                        )
                      ) : projectGroups.length === 0 ? (
                        <div className={styles.Empty}>No groups</div>
                      ) : (
                        projectGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            <div className={styles.OptionRow}>
                              {group.emoji && <span>{group.emoji}</span>}
                              <span>{group.name}</span>
                              <div
                                className={styles.Dot}
                                style={{ backgroundColor: group.color }}
                              />
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className={styles.Field}>
                  <Label>Layout</Label>
                  <div className={styles.ButtonRow}>
                    <Button
                      type="button"
                      variant={boardViewMode === 'cards' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setBoardViewMode('cards');
                        setColSpan(1);
                      }}
                      className={styles.ToggleWithIcon}
                    >
                      <LayoutGrid className={styles.ButtonIcon} />
                      Cards
                    </Button>
                    <Button
                      type="button"
                      variant={boardViewMode === 'mini-kanban' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setBoardViewMode('mini-kanban');
                        setColSpan(2);
                      }}
                      className={styles.ToggleWithIcon}
                    >
                      <Columns2 className={styles.ButtonIcon} />
                      Mini board
                    </Button>
                  </div>
                  <p className={styles.Hint}>
                    Mini board sets widget width to 2 columns. Shows To do and In progress only.
                  </p>
                </div>
              </div>
            )}

            {/* Active Projects Type Selection */}
            {selectedType === 'active-projects' && (
              <div className={styles.Field}>
                <Label>Show</Label>
                <div className={styles.ButtonRow}>
                  <Button
                    type="button"
                    variant={showType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowType('all')}
                    className={styles.Toggle}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant={showType === 'projects' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowType('projects')}
                    className={styles.ToggleWithIcon}
                  >
                    <FolderKanban className={styles.ButtonIcon} />
                    Projects
                  </Button>
                  <Button
                    type="button"
                    variant={showType === 'tasks' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowType('tasks')}
                    className={styles.ToggleWithIcon}
                  >
                    <ListTodo className={styles.ButtonIcon} />
                    Tasks
                  </Button>
                </div>
              </div>
            )}

            {/* Project Selection (for project-todos) */}
            {selectedType === 'project-todos' && (
              <div className={styles.Field}>
                <Label>Select Project</Label>
                <Select value={projectId || undefined} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <div className={styles.Empty}>
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

            {/* Filter Type (for todo-list and materials-shopping; not tag-lane-board) */}
            {(selectedType === 'todo-list' || selectedType === 'materials-shopping') && (
              <div className={styles.Field}>
                <Label>Filter By</Label>
                <div className={styles.ButtonRow}>
                  <Button
                    type="button"
                    variant={filterType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('all')}
                    className={styles.Toggle}
                  >
                    All Projects
                  </Button>
                  <Button
                    type="button"
                    variant={filterType === 'tag' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('tag')}
                    className={styles.ToggleWithIcon}
                  >
                    <Tags className={styles.ButtonIcon} />
                    Tag
                  </Button>
                  <Button
                    type="button"
                    variant={filterType === 'project-group' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('project-group')}
                    className={styles.ToggleWithIcon}
                  >
                    <FolderKanban className={styles.ButtonIcon} />
                    Project Group
                  </Button>
                </div>
              </div>
            )}

            {/* Filter Selection (for todo-list and materials-shopping) */}
            {(selectedType === 'todo-list' || selectedType === 'materials-shopping') && filterType !== 'all' && (
              <div className={styles.Field}>
                <Label>
                  {filterType === 'tag' ? 'Select Tag' : 'Select Project Group'}
                </Label>
                <Select value={filterId || undefined} onValueChange={setFilterId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Choose a ${filterType === 'tag' ? 'tag' : 'project group'}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {filterType === 'tag' ? (
                      tags.length === 0 ? (
                        <div className={styles.Empty}>
                          No tags available
                        </div>
                      ) : (
                        tags.map((tag) => (
                          <SelectItem key={tag.name} value={tag.name}>
                            <div className={styles.OptionRow}>
                              {tag.emoji && <span>{tag.emoji}</span>}
                              <span>#{tag.name}</span>
                              <div 
                                className={styles.Dot} 
                                style={{ backgroundColor: tag.color }}
                              />
                            </div>
                          </SelectItem>
                        ))
                      )
                    ) : (
                      projectGroups.length === 0 ? (
                        <div className={styles.Empty}>
                          No project groups available
                        </div>
                      ) : (
                        projectGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            <div className={styles.OptionRow}>
                              {group.emoji && <span>{group.emoji}</span>}
                              <span>{group.name}</span>
                              <div 
                                className={styles.Dot} 
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

            </div>
            <div className={styles.Column}>
            {selectedType === 'tag-lane-board' && (
              <div className={styles.Stack}>
                <div className={styles.Field}>
                  <Label htmlFor="accent-headline">Headline (optional)</Label>
                  <Input
                    id="accent-headline"
                    value={accentHeadline}
                    onChange={(e) => setAccentHeadline(e.target.value)}
                    placeholder="e.g. 3D print queue"
                  />
                </div>
                <div className={styles.Field}>
                  <Label>Accent color (optional)</Label>
                  <div className={styles.SwatchRow}>
                    {['#64748b', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#22c55e'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        title={hex}
                        onClick={() => setAccentColor(hex)}
                        className={cn(styles.Swatch, accentColor === hex ? styles.SwatchSelected : styles.SwatchIdle)}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                    <Input
                      type="color"
                      value={accentColor || '#64748b'}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className={styles.ColorInput}
                      aria-label="Pick accent color"
                    />
                    {accentColor ? (
                      <Button type="button" variant="ghost" size="sm" className={styles.ClearButton} onClick={() => setAccentColor('')}>
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className={styles.Field}>
                  <Label htmlFor="accent-emoji">Emoji (optional)</Label>
                  <Input
                    id="accent-emoji"
                    value={accentEmoji}
                    onChange={(e) => setAccentEmoji(e.target.value)}
                    placeholder="e.g. 🖨️"
                    maxLength={4}
                  />
                  <p className={styles.Hint}>If set, emoji is shown instead of the icon below.</p>
                </div>
                <div className={styles.Field}>
                  <Label>Icon (optional)</Label>
                  <Select value={accentLucide || '__none__'} onValueChange={(v) => setAccentLucide(v === '__none__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {TAG_LANE_ACCENT_LUCIDE_OPTIONS.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Show Completed/Owned — not used on day-plan, active-projects, or tag-lane-board */}
            {(selectedType === 'todo-list' ||
              selectedType === 'materials-shopping' ||
              selectedType === 'project-todos') && (
              <div className={styles.CheckboxRow}>
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
                <Label htmlFor="show-completed" className={styles.ClickableLabel}>
                  {selectedType === 'materials-shopping'
                    ? 'Show items already owned'
                    : 'Show completed tasks'}
                </Label>
              </div>
            )}

            {/* Location — which dashboard layout this widget belongs to */}
            {locations.length > 0 && (
              <div className={styles.Section}>
                <Label>Show at</Label>
                <div className={styles.ButtonRow}>
                  {[{ key: null as string | null, label: 'Everywhere', emoji: null as string | null }, ...locations].map((loc) => (
                    <button
                      key={loc.key ?? '__all'}
                      type="button"
                      onClick={() => setLocationKey(loc.key)}
                      className={cn(styles.Choice, locationKey === loc.key ? styles.ChoiceActive : styles.ChoiceIdle)}
                    >
                      {loc.emoji ? `${loc.emoji} ` : ''}{loc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Widget Width */}
            <div className={styles.Section}>
              <Label>Width</Label>
              <div className={styles.ButtonRow}>
                <button
                  type="button"
                  onClick={() => setColSpan(1)}
                  className={cn(styles.WidthChoice, colSpan === 1 ? styles.ChoiceActive : styles.ChoiceIdle)}
                >
                  <div className={cn(styles.WidthPreview, styles.WidthPreview1)} />
                  <span className={styles.Hint}>1 col</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColSpan(2)}
                  className={cn(styles.WidthChoice, colSpan === 2 ? styles.ChoiceActive : styles.ChoiceIdle)}
                >
                  <div className={cn(styles.WidthPreview, styles.WidthPreview2)} />
                  <span className={styles.Hint}>2 cols</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColSpan(3)}
                  className={cn(styles.WidthChoice, colSpan === 3 ? styles.ChoiceActive : styles.ChoiceIdle)}
                >
                  <div className={cn(styles.WidthPreview, styles.WidthPreview3)} />
                  <span className={styles.Hint}>3 cols</span>
                </button>
              </div>
              <p className={styles.Hint}>Drag the bottom edge of a widget to adjust height</p>
            </div>
            </div>
            </div>
          </div>
        )}

        {step === 'config' && saveError ? (
          <div className={styles.ErrorBar}>
            {saveError}
          </div>
        ) : null}

        <DialogFooter className={styles.Footer}>
          {/* Delete button - only when editing */}
          {step === 'config' && editingWidget && (
            <Button 
              variant="ghost" 
              onClick={handleDelete}
              disabled={isDeleting}
              className={styles.DeleteButton}
            >
              <Trash2 className={styles.DeleteIcon} />
              {isDeleting ? 'Deleting...' : 'Delete Widget'}
            </Button>
          )}
          
          <div className={styles.FooterActions}>
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


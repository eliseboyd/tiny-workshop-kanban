'use client';

import { useState, useMemo, useRef } from 'react';
import { ShoppingCart, Settings2, ExternalLink, Plus, Trash2, Pencil, Circle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateProject, updateWidget } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Project } from '@/components/kanban/KanbanBoard';
import { v4 as uuidv4 } from 'uuid';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';

// Helper to render text with clickable links
function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          {part.length > 40 ? part.slice(0, 40) + '...' : part}
          <ExternalLink className="h-3 w-3 inline flex-shrink-0" />
        </a>
      );
    }
    return part;
  });
}

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

type MaterialItem = {
  id: string;
  text: string;
  toBuy: boolean;
  toBuild: boolean; // "already own" status
  projectId: string;
  projectTitle: string;
  projectTags: string[];
  parentProjectId: string | null;
};

type StandaloneMaterial = {
  id: string;
  text: string;
  owned: boolean;
};

type MaterialsShoppingWidgetProps = {
  widget: {
    id: string;
    title: string;
    config: {
      filterType: 'all' | 'tag' | 'project-group';
      filterId?: string;
      showPurchased: boolean;
      standaloneMaterials?: StandaloneMaterial[];
    };
  };
  materials: MaterialItem[];
  projects: Project[];
  tags: Tag[];
  projectGroups: ProjectGroup[];
  onEdit: () => void;
  onRefresh?: () => void;
  onProjectClick?: (project: Project) => void;
};

type DisplayItem = {
  id: string;
  text: string;
  projectId?: string;
  projectTitle?: string;
  isStandalone: boolean;
};

export function MaterialsShoppingWidget({
  widget,
  materials,
  projects,
  tags,
  projectGroups,
  onEdit,
  onRefresh,
  onProjectClick,
}: MaterialsShoppingWidgetProps) {
  const router = useRouter();
  const dragListeners = useDragHandle();
  const [newItemText, setNewItemText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get standalone materials from widget config
  const standaloneMaterials = widget.config.standaloneMaterials || [];

  // Filter project materials
  const filteredProjectMaterials = useMemo(() => {
    let filtered = materials;

    // Show items that aren't already owned
    filtered = filtered.filter(m => !m.toBuild);

    // Then apply tag/project filter
    if (widget.config.filterType === 'tag' && widget.config.filterId) {
      filtered = filtered.filter(m => m.projectTags.includes(widget.config.filterId!));
    } else if (widget.config.filterType === 'project-group' && widget.config.filterId) {
      filtered = filtered.filter(m => m.parentProjectId === widget.config.filterId);
    }

    return filtered;
  }, [materials, widget.config]);

  // Combine into display items
  const displayItems: DisplayItem[] = useMemo(() => {
    const projectItems: DisplayItem[] = filteredProjectMaterials.map(m => ({
      id: m.id,
      text: m.text,
      projectId: m.projectId,
      projectTitle: m.projectTitle,
      isStandalone: false,
    }));

    const standaloneItems: DisplayItem[] = standaloneMaterials
      .filter(m => !m.owned)
      .map(m => ({
        id: m.id,
        text: m.text,
        isStandalone: true,
      }));

    return [...standaloneItems, ...projectItems];
  }, [filteredProjectMaterials, standaloneMaterials]);

  // Get filter description
  const filterDescription = useMemo(() => {
    if (widget.config.filterType === 'all') {
      return 'Materials from all projects';
    } else if (widget.config.filterType === 'tag') {
      const tag = tags.find(t => t.name === widget.config.filterId);
      return tag ? `Materials from "${tag.name}" projects` : null;
    } else {
      const group = projectGroups.find(g => g.id === widget.config.filterId);
      return group ? `Materials from "${group.name}"` : null;
    }
  }, [widget.config, tags, projectGroups]);

  const handleCheckOff = async (item: DisplayItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (item.isStandalone) {
      // Mark standalone item as owned
      const updatedStandalone = standaloneMaterials.map(m =>
        m.id === item.id ? { ...m, owned: true } : m
      );
      await updateWidget(widget.id, {
        config: { ...widget.config, standaloneMaterials: updatedStandalone },
      });
    } else {
      // Mark project material as "already own"
      const project = projects.find(p => p.id === item.projectId);
      if (!project) return;

      let materialsList: any[] = [];
      try {
        if (project.materialsList) {
          materialsList = typeof project.materialsList === 'string'
            ? JSON.parse(project.materialsList)
            : project.materialsList;
        }
      } catch (e) {
        console.error('Failed to parse materials list');
        return;
      }

      const updatedList = materialsList.map(m =>
        m.id === item.id ? { ...m, toBuild: true } : m
      );

      await updateProject(project.id, { materialsList: updatedList });
    }
    
    router.refresh();
    onRefresh?.();
  };

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;

    const newItem: StandaloneMaterial = {
      id: uuidv4(),
      text: newItemText.trim(),
      owned: false,
    };

    const updatedStandalone = [...standaloneMaterials, newItem];
    await updateWidget(widget.id, {
      config: { ...widget.config, standaloneMaterials: updatedStandalone },
    });

    setNewItemText('');
    router.refresh();
    onRefresh?.();
  };

  const handleDeleteItem = async (item: DisplayItem, e: React.MouseEvent) => {
    e.stopPropagation();

    if (item.isStandalone) {
      const updatedStandalone = standaloneMaterials.filter(m => m.id !== item.id);
      await updateWidget(widget.id, {
        config: { ...widget.config, standaloneMaterials: updatedStandalone },
      });
    } else {
      // Delete from project materials list
      const project = projects.find(p => p.id === item.projectId);
      if (!project) return;

      let materialsList: any[] = [];
      try {
        if (project.materialsList) {
          materialsList = typeof project.materialsList === 'string'
            ? JSON.parse(project.materialsList)
            : project.materialsList;
        }
      } catch (e) {
        console.error('Failed to parse materials list');
        return;
      }

      const updatedList = materialsList.filter(m => m.id !== item.id);
      await updateProject(project.id, { materialsList: updatedList });
    }

    router.refresh();
    onRefresh?.();
  };

  const handleStartEdit = (item: DisplayItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleSaveEdit = async (item: DisplayItem) => {
    if (!editText.trim()) {
      setEditingId(null);
      return;
    }

    if (item.isStandalone) {
      const updatedStandalone = standaloneMaterials.map(m =>
        m.id === item.id ? { ...m, text: editText.trim() } : m
      );
      await updateWidget(widget.id, {
        config: { ...widget.config, standaloneMaterials: updatedStandalone },
      });
    } else {
      // Update project material text
      const project = projects.find(p => p.id === item.projectId);
      if (!project) return;

      let materialsList: any[] = [];
      try {
        if (project.materialsList) {
          materialsList = typeof project.materialsList === 'string'
            ? JSON.parse(project.materialsList)
            : project.materialsList;
        }
      } catch (e) {
        console.error('Failed to parse materials list');
        return;
      }

      const updatedList = materialsList.map(m =>
        m.id === item.id ? { ...m, text: editText.trim() } : m
      );
      await updateProject(project.id, { materialsList: updatedList });
    }

    setEditingId(null);
    router.refresh();
    onRefresh?.();
  };

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

  const handleOpenProject = (item: DisplayItem) => {
    if (item.projectId && onProjectClick) {
      const project = projects.find(p => p.id === item.projectId);
      if (project) {
        trackRecentProject(project.id);
        onProjectClick(project);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item?: DisplayItem) => {
    if (e.key === 'Enter') {
      if (item) {
        handleSaveEdit(item);
      } else {
        handleAddItem();
      }
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setNewItemText('');
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden group flex flex-col h-full">
      {/* Header - draggable */}
      <div 
        className="px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10 flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...dragListeners}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-sm">{widget.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onEdit}
            title="Widget settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {filterDescription && (
          <p className="text-xs text-muted-foreground mt-1">{filterDescription}</p>
        )}
      </div>

      {/* Items List */}
      <ScrollFade>
        {displayItems.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Nothing to get</p>
          </div>
        ) : (
          <ul className="divide-y">
            {displayItems.map(item => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors group/item",
                  !item.projectTitle && "border-l-2 border-amber-500/30"
                )}
              >
                <button
                  className="flex-shrink-0 focus:outline-none"
                  onClick={(e) => handleCheckOff(item, e)}
                  title="Mark as owned"
                >
                  <Circle className="h-4 w-4 text-muted-foreground hover:text-amber-600 transition-colors" />
                </button>

                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    onBlur={() => handleSaveEdit(item)}
                    autoFocus
                    className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 p-0"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm block break-words cursor-pointer"
                      onDoubleClick={(e) => handleStartEdit(item, e)}
                    >
                      {renderTextWithLinks(item.text)}
                    </span>
                    {item.projectTitle && (
                      <button
                        onClick={() => handleOpenProject(item)}
                        className="text-xs text-muted-foreground hover:text-primary hover:underline truncate flex items-center gap-1 text-left"
                      >
                        <Link2 className="h-2.5 w-2.5 flex-shrink-0" />
                        {item.projectTitle}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={(e) => handleStartEdit(item, e)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteItem(item, e)}
                    className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>

      {/* Add Item Input */}
      <div className="border-t bg-muted/10 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            placeholder="Add an item..."
            className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
    </div>
  );
}

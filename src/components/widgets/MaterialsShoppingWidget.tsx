'use client';

import { useState, useMemo, useRef } from 'react';
import { ShoppingCart, Settings2, ExternalLink, Plus, Trash2, Pencil, Circle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateProject, updateWidget } from '@/app/actions';
import type { Project } from '@/components/kanban/KanbanBoard';
import { v4 as uuidv4 } from 'uuid';
import { ScrollFade } from './ScrollFade';
import { useDragHandle } from './WidgetsSection';
import { isInProjectGroup } from '@/lib/project-groups';
import styles from './MaterialsShoppingWidget.module.css';

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
          className={styles.Link}
        >
          {part.length > 40 ? part.slice(0, 40) + '...' : part}
          <ExternalLink className={styles.LinkIcon} />
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
  tags?: string[];
  matchMode?: 'any' | 'all';
};

type MaterialItem = {
  id: string;
  text: string;
  toBuy: boolean;
  toBuild: boolean; // "already own" status
  projectId: string;
  projectTitle: string;
  projectTags: string[];
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
      const group = projectGroups.find(g => g.id === widget.config.filterId);
      filtered = filtered.filter(m => group ? isInProjectGroup(m.projectTags, group) : false);
    }

    return filtered;
  }, [materials, projectGroups, widget.config]);

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

      let materialsList: { id: string; text: string; toBuy?: boolean; toBuild?: boolean }[] = [];
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

      let materialsList: { id: string; text: string; toBuy?: boolean; toBuild?: boolean }[] = [];
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

      let materialsList: { id: string; text: string; toBuy?: boolean; toBuild?: boolean }[] = [];
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
    <div className={styles.Root}>
      {/* Header - draggable */}
      <div 
        className={styles.Header}
        {...dragListeners}
      >
        <div className={styles.HeaderRow}>
          <div className={styles.TitleGroup}>
            <ShoppingCart className={styles.CartIcon} />
            <h3 className={styles.Title}>{widget.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={styles.SettingsButton}
            onClick={onEdit}
            title="Widget settings"
          >
            <Settings2 className={styles.SettingsIcon} />
          </Button>
        </div>
        {filterDescription && (
          <p className={styles.Subtitle}>{filterDescription}</p>
        )}
      </div>

      {/* Items List */}
      <ScrollFade>
        {displayItems.length === 0 ? (
          <div className={styles.Empty}>
            <p className={styles.EmptyText}>Nothing to get</p>
          </div>
        ) : (
          <ul className={styles.List}>
            {displayItems.map(item => (
              <li
                key={item.id}
                className={cn(styles.Item, !item.projectTitle && styles.Standalone)}
              >
                <button
                  className={styles.CheckButton}
                  onClick={(e) => handleCheckOff(item, e)}
                  title="Mark as owned"
                >
                  <Circle className={styles.CheckIcon} />
                </button>

                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    onBlur={() => handleSaveEdit(item)}
                    autoFocus
                    className={styles.EditInput}
                  />
                ) : (
                  <div className={styles.ItemBody}>
                    <span
                      className={styles.ItemText}
                      onDoubleClick={(e) => handleStartEdit(item, e)}
                    >
                      {renderTextWithLinks(item.text)}
                    </span>
                    {item.projectTitle && (
                      <button
                        onClick={() => handleOpenProject(item)}
                        className={styles.ProjectLink}
                      >
                        <Link2 className={styles.ProjectLinkIcon} />
                        {item.projectTitle}
                      </button>
                    )}
                  </div>
                )}

                <div className={styles.ItemActions}>
                  <button
                    onClick={(e) => handleStartEdit(item, e)}
                    className={styles.EditButton}
                    title="Edit"
                  >
                    <Pencil className={styles.ActionIcon} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteItem(item, e)}
                    className={styles.DeleteButton}
                    title="Delete"
                  >
                    <Trash2 className={styles.ActionIcon} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollFade>

      {/* Add Item Input */}
      <div className={styles.AddBar}>
        <div className={styles.AddRow}>
          <Plus className={styles.AddIcon} />
          <input
            ref={inputRef}
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            placeholder="Add an item..."
            className={styles.AddInput}
          />
        </div>
      </div>
    </div>
  );
}

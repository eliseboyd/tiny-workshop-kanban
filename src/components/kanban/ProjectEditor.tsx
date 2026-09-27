'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Project, Column } from './KanbanBoard';
import { updateProject, generateProjectImage, uploadImageBase64, uploadFile, getAllTags, ensureTagExists, moveProjectFromDoneIfNeeded, fetchAndSetOgImage, getColumns, moveIdeaToKanban, moveProjectToIdeas, deleteProject, getImageStyles, saveImageFromUrl, setProjectCompletedState, setProjectArchived, type ImageStyle } from '@/app/actions';
import Image from 'next/image';
import { Loader2, Sparkles, Trash2, Upload, Image as ImageIcon, X, FileText, Maximize2, ChevronLeft, ChevronRight, Plus, Images, ExternalLink, Pencil, FolderKanban, ListTodo, CheckCircle2, Circle, Lightbulb, Crop, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './ProjectEditor.module.css';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbox, type LightboxItem } from '@/components/ui/lightbox';
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { compressImage } from '@/utils/image-compression';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { ProjectTodos } from './ProjectTodos';
import { getLocationState } from '@/app/merlin-actions';
import type { MerlinLocation } from '@/types/locations';

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(() => import('@/components/ui/pdf-viewer').then(mod => ({ default: mod.PDFViewer })), {
  ssr: false,
  loading: () => (
    <div className={styles.PdfLoading}>
      <Loader2 className={styles.SpinnerLg} />
    </div>
  )
});

// Code-split react-image-crop — only mounts when the user starts a crop.
const ImageCropModal = dynamic(() => import('./ImageCropModal').then(mod => ({ default: mod.ImageCropModal })), { loading: () => null });

// Code-split tiptap (~150KB) — the editor only mounts when a project modal opens.
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then(mod => ({ default: mod.RichTextEditor })),
  {
    ssr: false,
    loading: () => (
      <div className={styles.EditorLoading}>
        Loading editor…
      </div>
    ),
  }
);

type Attachment = { id: string; url: string; name: string; type: string; size: number };
type Material = { id: string; text: string; toBuy: boolean; toBuild: boolean };

// Helper to render text with clickable links
function renderTextWithLinks(text: string, className?: string) {
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
          {part.length > 50 ? part.slice(0, 50) + '...' : part}
          <ExternalLink className={styles.LinkIcon} />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
type TagMetadata = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type IdeaNavigation = {
  current: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
};

type ProjectEditorProps = {
  project: Project;
  onClose?: () => void;
  isModal?: boolean;
  className?: string;
  ideaNavigation?: IdeaNavigation;
  onMoveToIdeas?: () => void;
  onProjectUpdate?: (id: string, updates: Partial<Project>) => void;
  onProjectDelete?: (id: string) => void;
  onArchiveChange?: (id: string, archived: boolean) => void;
  // The board already holds Merlin's locations; passing them in lets the
  // dropdown render at once instead of queueing behind the editor's other
  // server actions. Fetched here only where no list is passed (project page).
  locations?: MerlinLocation[];
};

function StylePicker({
  imageStyles,
  onSelect,
  className,
}: {
  imageStyles: ImageStyle[];
  onSelect: (styleId?: string) => void;
  className?: string;
}) {
  return (
    <div className={cn(styles.StylePicker, className)}>
      <p className={styles.StylePickerLabel}>Choose style</p>
      <div className={styles.StyleGrid}>
        <button
          className={styles.StyleOption}
          onClick={() => onSelect(undefined)}
        >
          <div className={styles.StyleThumbDefault}>
            <Sparkles className={styles.StyleThumbIcon} />
          </div>
          <span className={styles.StyleName}>Default</span>
        </button>
        {imageStyles.map((style) => (
          <button
            key={style.id}
            className={styles.StyleOption}
            onClick={() => onSelect(style.id)}
          >
            <div className={styles.StyleThumb}>
              {style.referenceImages[0] ? (
                <Image
                  src={style.referenceImages[0]}
                  alt={style.name}
                  width={32}
                  height={32}
                  className={styles.StyleThumbImg}
                  unoptimized
                />
              ) : (
                <div className={styles.StyleThumbFallback}>
                  <Wand2 className={styles.StyleThumbFallbackIcon} />
                </div>
              )}
            </div>
            <span className={styles.StyleName}>{style.name}</span>
          </button>
        ))}
      </div>
      {imageStyles.length === 0 && (
        <p className={styles.StyleHint}>
          Add styles in Settings → AI Styles
        </p>
      )}
    </div>
  );
}

export function ProjectEditor({ project, onClose, isModal = false, className, ideaNavigation, onMoveToIdeas, onProjectUpdate, onProjectDelete, onArchiveChange, locations: locationsProp }: ProjectEditorProps) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [ogImageError, setOgImageError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingOgImage, setIsFetchingOgImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingPlans, setIsDraggingPlans] = useState(false);
  const [isDraggingInspiration, setIsDraggingInspiration] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInspiration, setIsUploadingInspiration] = useState(false);
  const [uploadingInspirationCount, setUploadingInspirationCount] = useState(0);
  const [showInspirationPicker, setShowInspirationPicker] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropInspirationItem, setCropInspirationItem] = useState<{ id: string; url: string } | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [imageStyles, setImageStyles] = useState<ImageStyle[]>([]);
  const [isStylePickerOpen, setIsStylePickerOpen] = useState(false);
  // Tracks a Pollinations URL that's being loaded by the hidden <img> loader
  const [pendingPollinationsUrl, setPendingPollinationsUrl] = useState<string | null>(null);
  const [isImagePending, setIsImagePending] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateAttempt, setGenerateAttempt] = useState(0);
  const imageLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingGenParamsRef = useRef<{ title: string; richContent: string; styleId?: string; inspirationUrls: string[] } | null>(null);
  
  // Simple local state for immediate UI updates
  const [title, setTitle] = useState(project.title);
  const [imageUrl, setImageUrl] = useState(project.imageUrl || '');
  const [richContent, setRichContent] = useState(project.richContent || '');
  const [tags, setTags] = useState<string[]>(project.tags || []);
  const [isCompleted, setIsCompleted] = useState<boolean>(project.isCompleted || false);
  const [isArchived, setIsArchived] = useState<boolean>(Boolean(project.archived_at));
  const [isIdea, setIsIdea] = useState<boolean>(project.isIdea || false);
  const [localItemType, setLocalItemType] = useState<'project' | 'task' | 'idea'>(
    project.isIdea ? 'idea' : project.isTask ? 'task' : 'project'
  );
  const [columns, setColumns] = useState<Column[]>([]);
  const [allTags, setAllTags] = useState<TagMetadata[]>([]);
  const [fetchedLocations, setFetchedLocations] = useState<MerlinLocation[]>([]);
  const locations = locationsProp ?? fetchedLocations;
  const [locationKey, setLocationKey] = useState<string | null>(project.location_key ?? null);
  const [materialsList, setMaterialsList] = useState<Material[]>(() => {
    try {
      if (!project.materialsList) return [];
      if (typeof project.materialsList === 'string') {
        const parsed = JSON.parse(project.materialsList || '[]');
        return Array.isArray(parsed) ? parsed : [];
      }
      return Array.isArray(project.materialsList) ? project.materialsList : [];
    } catch (e) { 
      console.error('Failed to parse materialsList:', e);
      return []; 
    }
  });
  const [plans, setPlans] = useState<Attachment[]>(() => {
    try {
      if (!project.plans) return [];
      if (typeof project.plans === 'string') {
        const parsed = JSON.parse(project.plans || '[]');
        return Array.isArray(parsed) ? parsed : [];
      }
      return Array.isArray(project.plans) ? project.plans : [];
    } catch (e) { 
      console.error('Failed to parse plans:', e);
      return []; 
    }
  });
  const [inspiration, setInspiration] = useState<Attachment[]>(() => {
    try {
      if (!project.inspiration) return [];
      if (typeof project.inspiration === 'string') {
        const parsed = JSON.parse(project.inspiration || '[]');
        return Array.isArray(parsed) ? parsed : [];
      }
      return Array.isArray(project.inspiration) ? project.inspiration : [];
    } catch (e) {
      console.error('Failed to parse inspiration:', e);
      return [];
    }
  });
  const [currentInspirationIndex, setCurrentInspirationIndex] = useState(0);
  const inspirationScrollRef = useRef<HTMLDivElement>(null);
  
  const [tagInput, setTagInput] = useState('');
  const [materialsInput, setMaterialsInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [isHoveringCover, setIsHoveringCover] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [isHoveringInspiration, setIsHoveringInspiration] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingMaterialText, setEditingMaterialText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingMaterialRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const highlightedTagRef = useRef<TagMetadata | null>(null);
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inspirationSectionRef = useRef<HTMLDivElement>(null);
  
  // Open attachment in lightbox
  const openInspirationLightbox = (clickedItem: Attachment) => {
    console.log('Opening lightbox for:', clickedItem);
    const items: LightboxItem[] = inspiration.map(item => ({
      id: item.id,
      url: item.url,
      name: item.name,
      type: item.type,
    }));
    const index = inspiration.findIndex(item => item.id === clickedItem.id);
    console.log('Lightbox items:', items.length, 'Index:', index);
    setLightboxItems(items);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  
  const openAttachment = (url: string, type: string, name: string) => {
    // For plans section, keep old behavior (open in new tab)
    window.open(url, '_blank');
  };
  
  const closeAttachment = () => {
    setViewingAttachment(null);
  };
  
  // Get all viewable items (plans + inspiration)
  const allViewableItems = useMemo(() => [...plans, ...inspiration], [plans, inspiration]);
  
  // Navigate to next/prev item in viewer
  const navigateAttachment = useCallback((direction: 'next' | 'prev') => {
    if (!viewingAttachment) return;
    const currentIndex = allViewableItems.findIndex(item => item.url === viewingAttachment.url);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % allViewableItems.length;
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = allViewableItems.length - 1;
    }
    
    const newItem = allViewableItems[newIndex];
    setViewingAttachment({ url: newItem.url, type: newItem.type, name: newItem.name });
  }, [viewingAttachment, allViewableItems]);
  
  // Keyboard navigation for attachment viewer
  useEffect(() => {
    if (!viewingAttachment) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAttachment();
      } else if (e.key === 'ArrowRight') {
        navigateAttachment('next');
      } else if (e.key === 'ArrowLeft') {
        navigateAttachment('prev');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingAttachment, navigateAttachment]);
  
  // Track pending changes for immediate save on unmount/background
  const pendingChangesRef = useRef<Partial<Project> | null>(null);
  const saveInProgressRef = useRef<Promise<boolean> | null>(null);
  
  // Immediate save function (no debounce)
  const immediatelySave = useCallback(async (data: Partial<Project>) => {
    const savePromise = (async () => {
      try {
        await updateProject(project.id, data);
        pendingChangesRef.current = null;
        
        // If richContent was saved and has unchecked todos, move project from Done
        if (data.richContent && hasUncheckedTodos(data.richContent)) {
          await moveProjectFromDoneIfNeeded(project.id);
        }
        
        return true;
      } catch (error) {
        console.error('Save failed:', error);
        return false;
      } finally {
        saveInProgressRef.current = null;
      }
    })();
    
    saveInProgressRef.current = savePromise;
    return savePromise;
  }, [project.id]);
  
  // Simple debounced save function
  const debouncedSave = useCallback((data: Partial<Project>) => {
    // Track what needs to be saved
    pendingChangesRef.current = { ...pendingChangesRef.current, ...data };
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      const savePromise = (async (): Promise<boolean> => {
        try {
          await updateProject(project.id, data);
          pendingChangesRef.current = null;
          
          // If richContent was saved and has unchecked todos, move project from Done
          if (data.richContent && hasUncheckedTodos(data.richContent)) {
            await moveProjectFromDoneIfNeeded(project.id);
          }
          
          return true;
        } catch (error) {
          console.error('Save failed:', error);
          return false;
        } finally {
          setIsSaving(false);
          saveInProgressRef.current = null;
        }
      })();
      
      saveInProgressRef.current = savePromise;
      await savePromise;
    }, 300);
  }, [project.id]);
  
  // Save immediately when component unmounts or page is backgrounded (critical for mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && pendingChangesRef.current) {
        // Page is being backgrounded - save immediately
        immediatelySave(pendingChangesRef.current);
      }
    };
    
    const handleBeforeUnload = () => {
      if (pendingChangesRef.current) {
        // User is navigating away - save immediately
        immediatelySave(pendingChangesRef.current);
      }
    };
    
    // Listen for page visibility changes (mobile backgrounding)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Listen for page unload (navigation away)
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      // Component unmounting - save any pending changes
      if (pendingChangesRef.current) {
        immediatelySave(pendingChangesRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [immediatelySave]);
  
  // Handle modal close - save before closing
  const handleClose = async () => {
    // Cancel any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Wait for any in-flight save to complete
    if (saveInProgressRef.current) {
      setIsSaving(true);
      await saveInProgressRef.current;
      setIsSaving(false);
    }
    
    // Save any pending changes immediately
    if (pendingChangesRef.current) {
      setIsSaving(true);
      await immediatelySave(pendingChangesRef.current);
      setIsSaving(false);
    }
    
    // Now close
    onClose?.();
  };

  const handleDeleteProject = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const ok = await confirmDialog({
      title: 'Delete project?',
      description: 'This project will be permanently removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteProject(project.id);
    } catch (error) {
      console.error('Failed to delete project:', error);
      return;
    }

    onProjectDelete?.(project.id);
    onClose?.();
  };
  
  // Archiving closes the modal (the card leaves the board / Ideas grid);
  // unarchiving keeps it open so the change is visible.
  const handleToggleArchived = async () => {
    const next = !isArchived;
    try {
      await setProjectArchived(project.id, next);
    } catch (error) {
      console.error('Failed to archive project:', error);
      return;
    }
    setIsArchived(next);
    onArchiveChange?.(project.id, next);
    if (next) await handleClose();
  };

  // Handle back navigation - save before navigating
  const handleBack = async () => {
    // Cancel any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Wait for any in-flight save to complete
    if (saveInProgressRef.current) {
      setIsSaving(true);
      await saveInProgressRef.current;
      setIsSaving(false);
    }
    
    // Save any pending changes immediately
    if (pendingChangesRef.current) {
      setIsSaving(true);
      await immediatelySave(pendingChangesRef.current);
      setIsSaving(false);
    }
    
    // Now navigate back
    router.push('/');
  };
  
  // Title handler
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave({ title: newTitle });
  };
  
  // Helper to check if content has unchecked todos
  const hasUncheckedTodos = (html: string): boolean => {
    const matches = html.match(/<li[^>]*data-type=["']?taskItem["']?[^>]*>/gi);
    if (!matches) return false;
    
    for (const match of matches) {
      const checkedMatch = match.match(/data-checked=["']?(true|false)["']?/i);
      if (checkedMatch && checkedMatch[1].toLowerCase() === 'false') {
        return true;
      }
    }
    return false;
  };

  // Rich content handler
  const handleContentChange = (content: string) => {
    setRichContent(content);
    debouncedSave({ richContent: content });
  };
  
  // Tags handlers
  const handleAddTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed || tags.includes(trimmed)) return;
    
    // Ensure tag exists in database
    await ensureTagExists(trimmed);
    
    const newTags = [...tags, trimmed];
    setTags(newTags);
    await updateProject(project.id, { tags: newTags });
    setTagInput('');
    setShowTagSuggestions(false);
    
    // Reload tags to get the newly created one
    const tagsData = await getAllTags();
    setAllTags(tagsData.map(t => ({ ...t, emoji: t.emoji ?? undefined, icon: t.icon ?? undefined })));
    
  };
  
  const handleRemoveTag = async (tag: string) => {
    const newTags = tags.filter(t => t !== tag);
    setTags(newTags);
    await updateProject(project.id, { tags: newTags });
  };

  // Get tag suggestions for autocomplete
  const tagSuggestions = useMemo(() => {
    const input = tagInput.toLowerCase().replace(/^#/, '');
    
    // If no input, show all available tags (when focused)
    if (!input.trim()) {
      return allTags
        .filter(tag => !tags.includes(tag.name))
        .slice(0, 10);
    }
    
    // Otherwise filter by input
    return allTags
      .filter(tag => 
        tag.name.toLowerCase().includes(input) && 
        !tags.includes(tag.name)
      )
      .slice(0, 5);
  }, [tagInput, allTags, tags]);

  // Completed status handler — must update kanban column (`status`), not only `is_completed`
  const handleToggleCompleted = async () => {
    const prev = isCompleted;
    const newIsCompleted = !prev;
    setIsCompleted(newIsCompleted);
    const result = await setProjectCompletedState(project.id, newIsCompleted);
    if (!result) {
      setIsCompleted(prev);
      return;
    }
    setIsCompleted(result.isCompleted);
    onProjectUpdate?.(project.id, {
      isCompleted: result.isCompleted,
      status: result.status,
      position: result.position,
    });
  };

  const handleMoveToIdeas = async () => {
    await moveProjectToIdeas(project.id);
    setIsIdea(true);
    setLocalItemType('idea');
    onMoveToIdeas?.();
  };

  const handleTypeChange = async (newType: string) => {
    const type = newType as 'project' | 'task' | 'idea';
    if (type === localItemType) return;
    setLocalItemType(type);
    if (type === 'idea') {
      await handleMoveToIdeas();
    } else if (isIdea) {
      // Move to the first available column automatically
      const firstColumnId = columns[0]?.id;
      if (firstColumnId) {
        await moveIdeaToKanban(project.id, firstColumnId);
      }
      if (type === 'task') {
        await updateProject(project.id, { is_task: true });
      }
      setIsIdea(false);
      onClose?.();
    } else {
      await updateProject(project.id, { is_task: type === 'task' });
    }
  };
  
  // Materials handlers
  const handleAddMaterial = async () => {
    if (!materialsInput.trim()) return;
    
    // Check if input contains multiple lines (bulk paste)
    const lines = materialsInput.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length > 1) {
      // Bulk add multiple materials
      const newMaterials = lines.map(line => ({
        id: Math.random().toString(36).substr(2, 9),
        text: line,
        toBuy: false,
        toBuild: false
      }));
      const newList = [...materialsList, ...newMaterials];
      setMaterialsList(newList);
      await updateProject(project.id, { materialsList: newList });
    } else {
      // Single material
      const newMaterial: Material = {
        id: Math.random().toString(36).substr(2, 9),
        text: materialsInput.trim(),
        toBuy: false,
        toBuild: false
      };
      const newList = [...materialsList, newMaterial];
      setMaterialsList(newList);
      await updateProject(project.id, { materialsList: newList });
    }
    
    setMaterialsInput('');
  };
  
  const handleMaterialsPaste = async (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    const lines = pastedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // If pasting multiple lines, prevent default and bulk add
    if (lines.length > 1) {
      e.preventDefault();
      
      const newMaterials = lines.map(line => ({
        id: Math.random().toString(36).substr(2, 9),
        text: line,
        toBuy: false,
        toBuild: false
      }));
      const newList = [...materialsList, ...newMaterials];
      setMaterialsList(newList);
      await updateProject(project.id, { materialsList: newList });
      setMaterialsInput('');
    }
    // If single line, let default paste behavior work
  };
  
  const handleUpdateMaterial = async (id: string, field: 'toBuy' | 'toBuild') => {
    const newList = materialsList.map(item => 
      item.id === id ? { ...item, [field]: !item[field] } : item
    );
    setMaterialsList(newList);
    await updateProject(project.id, { materialsList: newList });
  };
  
  const handleDeleteMaterial = async (id: string) => {
    const newList = materialsList.filter(item => item.id !== id);
    setMaterialsList(newList);
    await updateProject(project.id, { materialsList: newList });
  };

  const handleStartEditMaterial = (id: string, currentText: string) => {
    setEditingMaterialId(id);
    setEditingMaterialText(currentText);
  };

  const handleSaveEditMaterial = async () => {
    if (!editingMaterialId || editingMaterialText.trim() === '') {
      setEditingMaterialId(null);
      return;
    }
    
    const newList = materialsList.map(item => 
      item.id === editingMaterialId ? { ...item, text: editingMaterialText.trim() } : item
    );
    setMaterialsList(newList);
    await updateProject(project.id, { materialsList: newList });
    setEditingMaterialId(null);
  };

  const handleCancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditingMaterialText('');
  };
  
  // Plans handlers
  const handlePlansUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append('file', file);
        const result = await uploadFile(fd);
        newAttachments.push(result);
      }
      const newPlans = [...plans, ...newAttachments];
      setPlans(newPlans);
      await updateProject(project.id, { plans: newPlans });
    } catch (error) {
      console.error('Failed to upload plans', error);
    }
    if (e.target) e.target.value = '';
  };
  
  const handleRemovePlan = async (id: string) => {
    const newPlans = plans.filter(item => item.id !== id);
    setPlans(newPlans);
    await updateProject(project.id, { plans: newPlans });
  };
  
  // Inspiration handlers
  const handleInspirationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploadingInspiration(true);
    setUploadingInspirationCount(files.length);
    
    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Compress image before upload
        const compressedFile = await compressImage(file);
        
        const fd = new FormData();
        fd.append('file', compressedFile);
        const result = await uploadFile(fd);
        newAttachments.push(result);
        
        // Update count as we progress
        setUploadingInspirationCount(files.length - i - 1);
      }
      const newInspiration = [...inspiration, ...newAttachments];
      setInspiration(newInspiration);
      
      // If uploading a single image and no cover is set, use it as cover
      const updateData: Record<string, unknown> = { inspiration: newInspiration };
      if (files.length === 1 && !imageUrl && newAttachments[0]) {
        setImageUrl(newAttachments[0].url);
        updateData.imageUrl = newAttachments[0].url;
      }
      
      await updateProject(project.id, updateData);
    } catch (error) {
      console.error('Failed to upload inspiration', error);
    } finally {
      setIsUploadingInspiration(false);
      setUploadingInspirationCount(0);
    }
    if (e.target) e.target.value = '';
  };
  
  const handleRemoveInspiration = async (id: string) => {
    // Find the item being removed
    const itemToRemove = inspiration.find(item => item.id === id);
    const newInspiration = inspiration.filter(item => item.id !== id);
    setInspiration(newInspiration);
    
    // If the removed item was the cover image, remove the cover too
    if (itemToRemove && itemToRemove.url === imageUrl) {
      setImageUrl('');
      await updateProject(project.id, { inspiration: newInspiration, imageUrl: null });
    } else {
      await updateProject(project.id, { inspiration: newInspiration });
    }
    
  };
  
  const handleSetInspirationAsCover = async (url: string) => {
    setImageUrl(url);
    await updateProject(project.id, { imageUrl: url });
  };

  // Handle inspiration carousel scroll
  const handleInspirationScroll = useCallback(() => {
    if (inspirationScrollRef.current && inspiration.length > 0) {
      const scrollLeft = inspirationScrollRef.current.scrollLeft;
      const itemWidth = inspirationScrollRef.current.offsetWidth;
      const index = Math.round(scrollLeft / itemWidth);
      setCurrentInspirationIndex(index);
    }
  }, [inspiration.length]);

  const scrollToInspirationIndex = (index: number) => {
    if (inspirationScrollRef.current) {
      const itemWidth = inspirationScrollRef.current.offsetWidth;
      inspirationScrollRef.current.scrollTo({
        left: index * itemWidth,
        behavior: 'smooth'
      });
    }
  };
  
  // Image upload handlers
  const handleFileUpload = async (file: File) => {
    setIsUploadingCover(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file);
      
      const fd = new FormData();
      fd.append('file', compressedFile);
      const result = await uploadFile(fd);
      setImageUrl(result.url);
      
      // Also add to inspiration
      const newInspiration = [...inspiration, result];
      setInspiration(newInspiration);
      
      await updateProject(project.id, { 
        imageUrl: result.url,
        inspiration: newInspiration 
      });
    } catch (error) {
      console.error('Failed to upload image', error);
    } finally {
      setIsUploadingCover(false);
    }
  };
  
  const handleRemoveCover = async () => {
    const currentCoverUrl = imageUrl;
    setImageUrl('');
    
    // Also remove from inspiration if it exists there
    const newInspiration = inspiration.filter(item => item.url !== currentCoverUrl);
    if (newInspiration.length !== inspiration.length) {
      setInspiration(newInspiration);
      await updateProject(project.id, { imageUrl: null, inspiration: newInspiration });
    } else {
      await updateProject(project.id, { imageUrl: null });
    }
    
  };
  
  // Clipboard paste handlers
  const handlePasteFromClipboard = async (items: DataTransferItemList, target: 'cover' | 'inspiration') => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          if (target === 'cover') {
            await handleFileUpload(file);
          } else {
            setIsUploadingInspiration(true);
            setUploadingInspirationCount(prev => prev + 1);
            try {
              // Compress image before upload
              const compressedFile = await compressImage(file);
              
              const fd = new FormData();
              fd.append('file', compressedFile);
              const result = await uploadFile(fd);
              
              const newInspiration = [...inspiration, result];
              setInspiration(newInspiration);
              
              // If no cover is set, use the pasted image as cover
              const updateData: Record<string, unknown> = { inspiration: newInspiration };
              if (!imageUrl) {
                setImageUrl(result.url);
                updateData.imageUrl = result.url;
              }
              
              await updateProject(project.id, updateData);
            } catch (error) {
              console.error('Failed to upload pasted image', error);
            } finally {
              setUploadingInspirationCount(prev => prev - 1);
              if (uploadingInspirationCount <= 1) {
                setIsUploadingInspiration(false);
              }
            }
          }
        }
        break;
      }
    }
  };
  
  // Global paste event listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.items) return;
      
      // Check if we're hovering over cover or inspiration sections
      if (isHoveringCover) {
        e.preventDefault();
        handlePasteFromClipboard(e.clipboardData.items, 'cover');
      } else if (isHoveringInspiration) {
        e.preventDefault();
        handlePasteFromClipboard(e.clipboardData.items, 'inspiration');
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isHoveringCover, isHoveringInspiration, inspiration]);
  
  const MAX_GENERATE_ATTEMPTS = 3;

  const startPollinationsLoad = (pollinationsUrl: string) => {
    if (imageLoadTimeoutRef.current) clearTimeout(imageLoadTimeoutRef.current);
    imageLoadTimeoutRef.current = setTimeout(() => {
      setIsImagePending(false);
      setPendingPollinationsUrl(null);
      setGenerateError('Image generation timed out after 90 seconds. Please try again.');
    }, 90_000);
    setPendingPollinationsUrl(pollinationsUrl);
    setIsImagePending(true);
  };

  const handleGenerateImage = async (styleId?: string) => {
    if (!title) return;
    setIsStylePickerOpen(false);
    setGenerateError(null);
    setGenerateAttempt(1);
    setIsGenerating(true);

    const inspirationUrls = inspiration
      .filter((a) => a.type.startsWith('image/'))
      .map((a) => a.url);

    // Save params so we can retry without re-opening the style picker
    pendingGenParamsRef.current = { title, richContent, styleId, inspirationUrls };

    try {
      const pollinationsUrl = await generateProjectImage(
        { title, description: richContent },
        styleId,
        inspirationUrls
      );
      startPollinationsLoad(pollinationsUrl);
    } catch (error) {
      console.error('[AI Generate] Failed to build prompt:', error);
      setGenerateError('Failed to start generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePollinationsLoad = async () => {
    if (!pendingPollinationsUrl) return;
    if (imageLoadTimeoutRef.current) clearTimeout(imageLoadTimeoutRef.current);
    const url = pendingPollinationsUrl;
    setPendingPollinationsUrl(null);
    try {
      // Image is loaded in browser → re-fetch server-side (now cached, so fast) → upload to Supabase
      const stableUrl = await saveImageFromUrl(url);
      const finalUrl = stableUrl ?? url;

      setImageUrl(finalUrl);
      const generatedAttachment = {
        id: `generated-${Date.now()}`,
        url: finalUrl,
        name: `${title} - AI Generated`,
        type: 'image/jpeg',
        size: 0,
      };
      const newInspiration = [...inspiration, generatedAttachment];
      setInspiration(newInspiration);
      await updateProject(project.id, { imageUrl: finalUrl, inspiration: newInspiration });
      setGenerateAttempt(0);
    } catch (err) {
      console.error('[AI Generate] Failed to save image to Supabase, using Pollinations URL:', err);
      setImageUrl(url);
      setGenerateAttempt(0);
    } finally {
      setIsImagePending(false);
    }
  };

  const handlePollinationsError = async () => {
    if (imageLoadTimeoutRef.current) clearTimeout(imageLoadTimeoutRef.current);
    setPendingPollinationsUrl(null);

    const params = pendingGenParamsRef.current;
    const attempt = generateAttempt;

    if (params && attempt < MAX_GENERATE_ATTEMPTS) {
      // Auto-retry: request a new URL with a fresh seed
      console.log(`[AI Generate] Attempt ${attempt} failed, retrying (${attempt + 1}/${MAX_GENERATE_ATTEMPTS})…`);
      setGenerateAttempt(attempt + 1);
      try {
        const pollinationsUrl = await generateProjectImage(
          { title: params.title, description: params.richContent },
          params.styleId,
          params.inspirationUrls
        );
        startPollinationsLoad(pollinationsUrl);
      } catch (err) {
        console.error('[AI Generate] Retry failed:', err);
        setIsImagePending(false);
        setGenerateError('Image generation failed after multiple attempts. Please try again.');
      }
    } else {
      setIsImagePending(false);
      setGenerateError('Image generation failed after multiple attempts. Please try again.');
    }
  };

  const handleFetchOgImage = async () => {
    setIsFetchingOgImage(true);
    try {
      const result = await fetchAndSetOgImage(project.id);
      if (result.success && result.imageUrl) {
        setImageUrl(result.imageUrl);
        setOgImageError(null);
      } else {
        setOgImageError(result.error || 'Could not find an image from the links in your project');
      }
    } catch (err) {
      console.error('Failed to fetch OG image:', err);
      setOgImageError('Failed to fetch image from link');
    } finally {
      setIsFetchingOgImage(false);
    }
  };
  
  // Inline image upload for rich text editor
  const handleContentImageUpload = async (file: File): Promise<string> => {
    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64 = reader.result as string;
            const imageUrl = await uploadImageBase64(base64, file.name, file.type);
            resolve(imageUrl);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Failed to upload inline image', error);
      throw error;
    }
  };
  
  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await handleFileUpload(file);
    }
  };
  
  // Plans drag and drop
  const handlePlansDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlans(true);
  };
  
  const handlePlansDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDraggingPlans(false);
  };
  
  const handlePlansDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlans(false);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Accept images and PDFs
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
          const fd = new FormData();
          fd.append('file', file);
          const result = await uploadFile(fd);
          newAttachments.push(result);
        }
      }
      if (newAttachments.length > 0) {
        const newPlans = [...plans, ...newAttachments];
        setPlans(newPlans);
        await updateProject(project.id, { plans: newPlans });
      }
    } catch (error) {
      console.error('Failed to upload plans via drag and drop', error);
    }
  };
  
  // Inspiration drag and drop
  const handleInspirationDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingInspiration(true);
  };

  const handleInspirationDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDraggingInspiration(false);
  };

  const handleInspirationDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingInspiration(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsUploadingInspiration(true);
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    setUploadingInspirationCount(imageFiles.length);

    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const compressedFile = await compressImage(imageFiles[i]);
        const fd = new FormData();
        fd.append('file', compressedFile);
        const result = await uploadFile(fd);
        newAttachments.push(result);
        setUploadingInspirationCount(imageFiles.length - i - 1);
      }
      if (newAttachments.length > 0) {
        const newInspiration = [...inspiration, ...newAttachments];
        setInspiration(newInspiration);
        const updateData: Record<string, unknown> = { inspiration: newInspiration };
        if (imageFiles.length === 1 && !imageUrl) {
          setImageUrl(newAttachments[0].url);
          updateData.imageUrl = newAttachments[0].url;
        }
        await updateProject(project.id, updateData);
      }
    } catch (error) {
      console.error('Failed to upload inspiration via drag and drop', error);
    } finally {
      setIsUploadingInspiration(false);
      setUploadingInspirationCount(0);
    }
  };

  // To-dos are a board-project thing (see the section below).
  const showTodos = localItemType === 'project';

  // Section navigation
  const scrollToSection = (section: string) => {
    setActiveSection(section);
    document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['overview', 'todos', 'materials', 'plans', 'inspiration'];
      for (const section of sections) {
        const el = document.getElementById(`section-${section}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    const container = document.querySelector('.editor-scroll-container');
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus input when editing material
  useEffect(() => {
    if (editingMaterialId && editingMaterialRef.current) {
      editingMaterialRef.current.focus();
      editingMaterialRef.current.select();
    }
  }, [editingMaterialId]);

  // Standalone project page only; the board passes its own list in.
  useEffect(() => {
    if (locationsProp) return;
    getLocationState().then(state => setFetchedLocations(state.locations));
  }, [locationsProp]);

  // Load project groups, tags, columns, and image styles
  useEffect(() => {
    const loadData = async () => {
      const [tagsData, columnsData, stylesData] = await Promise.all([
        getAllTags(),
        getColumns(),
        getImageStyles(),
      ]);
      setAllTags(tagsData.map(t => ({ ...t, emoji: t.emoji ?? undefined, icon: t.icon ?? undefined })));
      setColumns(columnsData);
      setImageStyles(stylesData);
    };
    loadData();
  }, []);

  // Close style picker on any click outside picker panels
  useEffect(() => {
    if (!isStylePickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-style-picker]')) {
        setIsStylePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStylePickerOpen]);
  
  // Sync local state when project prop changes (e.g., after a server action revalidates the board, or idea navigation)
  useEffect(() => {
    setLocalItemType(project.isIdea ? 'idea' : project.isTask ? 'task' : 'project');
  }, [project.isTask, project.isIdea]);

  useEffect(() => {
    setIsCompleted(project.isCompleted || false);
  }, [project.isCompleted]);

  useEffect(() => {
    setIsIdea(project.isIdea || false);
  }, [project.isIdea]);

  useEffect(() => {
    setIsArchived(Boolean(project.archived_at));
  }, [project.archived_at]);
  
  // Swipe back gesture for mobile with visual feedback
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeProgress, setSwipeProgress] = useState(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    const diffX = touchCurrentX - touchStartX.current;
    const diffY = touchCurrentY - touchStartY.current;
    
    // Enable swipe-back if:
    // 1. Swiping right (diffX > 0)
    // 2. More horizontal than vertical movement (prevents conflict with scrolling)
    if (diffX > 0 && diffX > Math.abs(diffY) * 1.5) {
      // Calculate progress (0 to 1, capped at 1)
      const progress = Math.min(diffX / 100, 1);
      setSwipeProgress(progress);
      
      // Prevent vertical scrolling while swiping back
      if (progress > 0.2) {
        e.preventDefault();
      }
    }
  };
  
  const handleTouchEnd = async (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX.current;
    const diffY = touchEndY - touchStartY.current;
    
    const currentProgress = swipeProgress;
    
    // Reset progress
    setSwipeProgress(0);
    
    // Trigger back if:
    // 1. Swiped right > 100px
    // 2. More horizontal than vertical (prevents accidental triggers while scrolling)
    if (diffX > 100 && diffX > Math.abs(diffY) * 1.5) {
      // Save before navigating back
      if (isModal && onClose) {
        await handleClose();
      } else {
        await handleBack();
      }
    }
  };
  
  return (
    <div className={cn(styles.Root, className)}>
      {ogImageError && (
        <div
          role="alert"
          className={styles.ErrorToast}
        >
          <span>{ogImageError}</span>
          <button
            onClick={() => setOgImageError(null)}
            aria-label="Dismiss error"
            className={styles.ErrorToastClose}
          >
            <X className={styles.IconXs} />
          </button>
        </div>
      )}
      {/* Swipe Back Indicator - Fixed position, outside scroll */}
      {swipeProgress > 0 && (
        <>
          {/* Edge Indicator */}
          <div 
            className={styles.SwipeBar}
            style={{ 
              opacity: swipeProgress,
              transform: `scaleY(${swipeProgress})`,
              transformOrigin: 'center'
            }}
          />
          {/* Text Indicator */}
          <div 
            className={styles.SwipeIndicator}
            style={{ 
              opacity: swipeProgress,
              transform: `translateX(${swipeProgress * 20 - 20}px)`
            }}
          >
            <div className={styles.SwipePill}>
              <ChevronLeft className={styles.SwipeIcon} />
              <span className={styles.SwipeLabel}>Back</span>
            </div>
          </div>
        </>
      )}
      
      {/* Sidebar (Desktop only) */}
      <div className={styles.Sidebar}>
        <div className={styles.SidebarTitle}>
          Contents
        </div>
        <button onClick={() => scrollToSection('overview')} className={cn(styles.SidebarLink, activeSection === 'overview' ? styles.SidebarLinkActive : styles.SidebarLinkInactive)}>
          Project Overview
        </button>
        {showTodos && (
          <button onClick={() => scrollToSection('todos')} className={cn(styles.SidebarLink, activeSection === 'todos' ? styles.SidebarLinkActive : styles.SidebarLinkInactive)}>
            To-dos
          </button>
        )}
        <button onClick={() => scrollToSection('materials')} className={cn(styles.SidebarLink, activeSection === 'materials' ? styles.SidebarLinkActive : styles.SidebarLinkInactive)}>
          Materials List
        </button>
        <button onClick={() => scrollToSection('plans')} className={cn(styles.SidebarLink, activeSection === 'plans' ? styles.SidebarLinkActive : styles.SidebarLinkInactive)}>
          Plans
        </button>
        <button onClick={() => scrollToSection('inspiration')} className={cn(styles.SidebarLink, activeSection === 'inspiration' ? styles.SidebarLinkActive : styles.SidebarLinkInactive)}>
          Inspiration
        </button>
        
        {isSaving && (
          <div className={styles.SidebarSaving}>
            <Loader2 className={styles.SpinnerXs} />
            Saving...
          </div>
        )}
      </div>

      {/* Main Content Wrapper */}
      <div 
        className={cn(styles.Main, "editor-scroll-container")}
        style={{
          transform: swipeProgress > 0 ? `translateX(${swipeProgress * 50}px)` : 'none',
          transition: swipeProgress === 0 ? 'transform 0.2s ease-out' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Header / Cover Image */}
        <div className={styles.CoverWrap}>
          <div 
            ref={imageAreaRef}
            className={cn(
              // The old markup also listed `bg-dots`, but twMerge dropped it in
              // favour of `bg-muted/30`, so the dots never rendered. Left out.
              styles.CoverArea,
              isDragging && styles.CoverAreaDragging,
              !imageUrl && styles.CoverAreaEmpty,
              isHoveringCover && styles.CoverAreaHovering
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseEnter={() => setIsHoveringCover(true)}
            onMouseLeave={() => setIsHoveringCover(false)}
            onClick={() => {
              // Only allow click-to-upload on desktop
              if (window.innerWidth >= 768 && !isGenerating) {
                fileInputRef.current?.click();
              }
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              className={styles.Hidden} 
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  console.log('File selected:', file.name, file.size, file.type);
                  await handleFileUpload(file);
                  // Reset input so same file can be selected again
                  e.target.value = '';
                }
              }}
            />
            
            {/* Hidden image loader — loads Pollinations URL without CORS restrictions */}
            {pendingPollinationsUrl && (
              // Use absolute off-screen positioning instead of display:none — some browsers
              // (notably Safari) skip loading images with display:none.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingPollinationsUrl}
                alt=""
                style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px', pointerEvents: 'none' }}
                onLoad={handlePollinationsLoad}
                onError={handlePollinationsError}
              />
            )}

            {isGenerating || isImagePending ? (
              <div className={styles.CoverStatus}>
                <Loader2 className={styles.SpinnerLg} />
                <p className={styles.CoverStatusText}>
                  {isGenerating ? 'Preparing your prompt…' : generateAttempt > 1 ? `Generating… (attempt ${generateAttempt}/${MAX_GENERATE_ATTEMPTS})` : 'Generating cover image…'}
                </p>
                {isImagePending && <p className={styles.CoverStatusHint}>This can take 15–30 seconds</p>}
              </div>
            ) : generateError ? (
              <div className={styles.CoverError}>
                <p className={styles.CoverErrorText}>{generateError}</p>
                <button
                  className={styles.CoverRetry}
                  onClick={() => setGenerateError(null)}
                >
                  Dismiss
                </button>
              </div>
            ) : isUploadingCover ? (
              <div className={styles.CoverUploading}>
                <Loader2 className={styles.SpinnerLg} />
                <p className={styles.CoverStatusText}>Uploading image...</p>
              </div>
            ) : imageUrl ? (
              <>
                <Image
                  src={imageUrl}
                  alt="Project cover"
                  fill
                  className={styles.ImageCover}
                  unoptimized
                />
                <div className={styles.CoverOverlay}>
                  <p className={styles.CoverOverlayText}>
                    <Upload className={styles.Icon} /> Change Cover
                  </p>
                </div>
              </>
            ) : (
              <div className={styles.CoverEmptyPrompt}>
                <ImageIcon className={styles.CoverEmptyIcon} />
                <p className={styles.CoverStatusText}>Click to upload or drag & drop</p>
                <p className={styles.CoverEmptyHint}>Hover and paste (Ctrl+V) to upload from clipboard</p>
              </div>
            )}
          </div>
          
          {/* Navigation / Actions Header */}
          <div className={styles.CoverTopBar}>
            {/* Back Button (Full Page) */}
            {!isModal && (
              <>
                {isSaving ? (
                  <span className={styles.SavingPill}>Saving...</span>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(styles.GlassButton, styles.GlassButtonTight)}
                    onClick={handleBack}
                  >
                    <ChevronLeft className={styles.Icon} /> Back
                  </Button>
                )}
              </>
            )}

            {/* Expand Button (Modal) */}
            {isModal && (
              <Link href={`/projects/${project.id}`} prefetch={false}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={cn(styles.GlassButton, styles.GlassButtonTight)}
                  title="Open in full view"
                >
                  <Maximize2 className={styles.Icon} />
                  <span className={styles.OpenAsPageLabel}>Open as Page</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Action Buttons */}
          {/* Mobile: Buttons at bottom */}
          <div className={styles.MobileCoverActions}>
            {imageUrl && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.MobileGlassButton}
                  onClick={(e) => { e.stopPropagation(); setIsCropOpen(true); }}
                  title="Crop Image"
                >
                  <Crop className={styles.Icon} />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.MobileGlassButton}
                  onClick={(e) => { e.stopPropagation(); handleRemoveCover(); }}
                  title="Remove Cover"
                >
                  <X className={styles.Icon} />
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(styles.MobileGlassButton, styles.Grow)}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isGenerating}
            >
              <Upload className={styles.IconLeading} />
              Upload
            </Button>
            <div className={styles.MobileStyleWrap} data-style-picker>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={cn(styles.MobileGlassButton, styles.FullWidth)}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStylePickerOpen((prev) => !prev);
                }}
                disabled={isGenerating || isImagePending || !title}
              >
                {isGenerating ? <Loader2 className={styles.IconLeadingSpin} /> : <Sparkles className={styles.IconLeading} />}
                Create with AI
              </Button>
              {isStylePickerOpen && (
                <StylePicker
                  imageStyles={imageStyles}
                  onSelect={handleGenerateImage}
                  className={styles.MobileStylePicker}
                />
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(styles.MobileGlassButton, styles.Grow)}
              onClick={(e) => {
                e.stopPropagation();
                handleFetchOgImage();
              }}
              disabled={isFetchingOgImage}
              title="Fetch image from links in project"
            >
              {isFetchingOgImage ? <Loader2 className={styles.IconLeadingSpin} /> : <ExternalLink className={styles.IconLeading} />}
              From Link
            </Button>
            {inspiration.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.MobileGlassButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInspirationPicker(!showInspirationPicker);
                }}
              >
                <Images className={styles.Icon} />
              </Button>
            )}
          </div>

          {/* Desktop: Buttons at bottom right */}
          <div className={cn(
            styles.DesktopCoverActions,
            imageUrl && styles.DesktopCoverActionsHidden
          )}>
            {imageUrl && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.GlassButton}
                  onClick={(e) => { e.stopPropagation(); setIsCropOpen(true); }}
                  title="Crop Image"
                >
                  <Crop className={styles.IconXs} />
                  <span className={styles.ButtonLabel}>Crop</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.GlassButton}
                  onClick={(e) => { e.stopPropagation(); handleRemoveCover(); }}
                  title="Remove Cover"
                >
                  <X className={styles.IconXs} />
                  <span className={styles.ButtonLabel}>Remove</span>
                </Button>
              </>
            )}
            <div className={styles.StylePickerAnchor} data-style-picker>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.GlassButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStylePickerOpen((prev) => !prev);
                }}
                disabled={isGenerating || isImagePending || !title}
                title="Generate AI Cover"
              >
                {isGenerating ? <Loader2 className={styles.SpinnerXs} /> : <Sparkles className={styles.IconXs} />}
                <span className={styles.ButtonLabel}>Generate Cover</span>
              </Button>
              {isStylePickerOpen && (
                <StylePicker
                  imageStyles={imageStyles}
                  onSelect={handleGenerateImage}
                  className={styles.DesktopStylePicker}
                />
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.GlassButton}
              onClick={(e) => {
                e.stopPropagation();
                handleFetchOgImage();
              }}
              disabled={isFetchingOgImage}
              title="Fetch image from links in project"
            >
              {isFetchingOgImage ? <Loader2 className={styles.SpinnerXs} /> : <ExternalLink className={styles.IconXs} />}
              <span className={styles.ButtonLabel}>From Link</span>
            </Button>
            {inspiration.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.GlassButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInspirationPicker(!showInspirationPicker);
                }}
                title="Choose from Inspiration"
              >
                <Images className={styles.IconXs} />
                <span className={styles.ButtonLabel}>From Inspiration</span>
              </Button>
            )}
          </div>

          {/* Inspiration Picker */}
          {showInspirationPicker && inspiration.length > 0 && (
            <div 
              className={styles.PickerBackdrop}
              onClick={(e) => {
                e.stopPropagation();
                setShowInspirationPicker(false);
              }}
            >
              <div 
                className={styles.PickerDialog}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.PickerHeader}>
                  <h3 className={styles.PickerTitle}>Choose from Inspiration</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.PickerClose}
                    onClick={() => setShowInspirationPicker(false)}
                  >
                    <X className={styles.Icon} />
                  </Button>
                </div>
                <div className={styles.PickerGrid}>
                  {inspiration.filter(item => item.type.startsWith('image/')).map(item => (
                    <button
                      key={item.id}
                      className={cn(
                        styles.PickerItem,
                        imageUrl === item.url ? styles.PickerItemSelected : styles.PickerItemUnselected
                      )}
                      onClick={async () => {
                        setImageUrl(item.url);
                        await updateProject(project.id, { imageUrl: item.url });
                        setShowInspirationPicker(false);
                      }}
                    >
                      <Image
                        src={item.url}
                        alt={item.name}
                        fill
                        className={styles.ImageCover}
                        unoptimized
                      />
                      {imageUrl === item.url && (
                        <div className={styles.PickerCheckOverlay}>
                          <div className={styles.PickerCheck}>
                            <svg className={styles.Icon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {inspiration.filter(item => item.type.startsWith('image/')).length === 0 && (
                  <p className={styles.PickerEmpty}>
                    No images in inspiration yet
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.Content}>
          {viewingAttachment ? (
            /* Attachment Viewer */
            <div className={styles.AttachmentView}>
              {/* Viewer Header */}
              <div className={styles.AttachmentHeader}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeAttachment}
                  className={styles.AttachmentBack}
                >
                  <ChevronLeft className={styles.Icon} />
                  Back to Project
                </Button>
                
                <div className={styles.AttachmentNav}>
                  {allViewableItems.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateAttachment('prev')}
                        className={styles.IconButton}
                      >
                        <ChevronLeft className={styles.Icon} />
                      </Button>
                      <span>
                        {allViewableItems.findIndex(item => item.url === viewingAttachment.url) + 1} / {allViewableItems.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateAttachment('next')}
                        className={styles.IconButton}
                      >
                        <ChevronRight className={styles.Icon} />
                      </Button>
                    </>
                  )}
                </div>
                
                <h2 className={styles.AttachmentTitle}>{viewingAttachment.name}</h2>
              </div>
              
              {/* Viewer Content */}
              <div className={styles.AttachmentBody}>
                {viewingAttachment.type.startsWith('image/') ? (
                  <div className={styles.AttachmentImageFrame}>
                    <Image
                      src={viewingAttachment.url}
                      alt={viewingAttachment.name}
                      width={1920}
                      height={1080}
                      className={styles.AttachmentImage}
                      unoptimized
                    />
                  </div>
                ) : viewingAttachment.type === 'application/pdf' ? (
                  <div className={styles.AttachmentPdf}>
                    <PDFViewer url={viewingAttachment.url} fileName={viewingAttachment.name} />
                  </div>
                ) : (
                  <div className={styles.AttachmentFallback}>
                    <FileText className={styles.AttachmentFallbackIcon} />
                    <p className={styles.AttachmentFallbackName}>{viewingAttachment.name}</p>
                    <a 
                      href={viewingAttachment.url} 
                      download 
                      className={styles.AttachmentDownload}
                    >
                      Download file
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.Sections}>
            {/* Idea prev/next navigation */}
            {ideaNavigation && (
              <div className={styles.IdeaNav}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!ideaNavigation.onPrev}
                  onClick={ideaNavigation.onPrev}
                  className={styles.IdeaNavButton}
                >
                  <ChevronLeft className={styles.Icon} /> Prev
                </Button>
                <span className={styles.IdeaNavCount}>
                  {ideaNavigation.current} / {ideaNavigation.total}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!ideaNavigation.onNext}
                  onClick={ideaNavigation.onNext}
                  className={styles.IdeaNavButton}
                >
                  Next <ChevronRight className={styles.Icon} />
                </Button>
              </div>
            )}
            {/* Title Section */}
            <div id="section-overview" className={styles.Stack2}>
              <textarea
                value={title}
                onChange={(e) => {
                  handleTitleChange(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                className={styles.TitleInput}
                placeholder="Untitled"
                rows={1}
                style={{ height: 'auto' }}
              />
              
              {/* Type selector */}
              <div className={styles.FieldRow}>
                <label className={styles.FieldLabel}>Type:</label>
                <Select value={localItemType} onValueChange={handleTypeChange}>
                  <SelectTrigger className={styles.FieldSelect}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">
                      <div className={styles.TypeOption}>
                        <FolderKanban className={styles.TypeIconProject} />
                        <span>Project</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="task">
                      <div className={styles.TypeOption}>
                        <ListTodo className={styles.TypeIconTask} />
                        <span>Task</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="idea">
                      <div className={styles.TypeOption}>
                        <Lightbulb className={styles.TypeIconIdea} />
                        <span>Idea</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location — hidden until Merlin has locations */}
              {locations.length > 0 && (
                <div className={styles.FieldRow}>
                  <label className={styles.FieldLabel}>Location:</label>
                  <Select
                    value={locationKey ?? '__any'}
                    onValueChange={async (v) => {
                      const next = v === '__any' ? null : v;
                      setLocationKey(next);
                      await updateProject(project.id, { locationKey: next });
                    }}
                  >
                    <SelectTrigger className={styles.FieldSelect}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Anywhere</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.key} value={loc.key}>
                          {loc.emoji ? `${loc.emoji} ` : ''}{loc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tags Row */}
              <div className={styles.Tags}>
                {tags.map(tag => {
                  const tagMeta = allTags.find(t => t.name === tag);
                  return (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className={styles.Tag}
                      style={{
                        backgroundColor: tagMeta?.color ? `${tagMeta.color}20` : undefined,
                        borderColor: tagMeta?.color || undefined,
                        color: tagMeta?.color || undefined,
                      }}
                    >
                      {tagMeta?.icon ? (
                        <div className={styles.TagIcon}>
                          <Image
                            src={tagMeta.icon}
                            alt={tag}
                            width={16}
                            height={16}
                            className={styles.TagIconImage}
                            unoptimized
                          />
                        </div>
                      ) : tagMeta?.emoji ? (
                        <span>{tagMeta.emoji}</span>
                      ) : null}
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className={styles.TagRemove}>
                        <X className={styles.IconXs} />
                      </button>
                    </Badge>
                  );
                })}
                <Autocomplete
                  mode="none"
                  items={tagSuggestions}
                  itemToStringValue={(tag: TagMetadata) => tag.name}
                  value={tagInput}
                  onValueChange={(value, details) => {
                    // Picking a suggestion is handled in its onClick.
                    if (details.reason === 'item-press') return;
                    setTagInput(value);
                    setShowTagSuggestions(true);
                  }}
                  open={showTagSuggestions && tagSuggestions.length > 0}
                  onOpenChange={setShowTagSuggestions}
                  onItemHighlighted={(tag) => {
                    highlightedTagRef.current = tag ?? null;
                  }}
                >
                  <div className={styles.TagInputWrap}>
                    <AutocompleteInput
                      ref={tagInputRef}
                      onFocus={() => setShowTagSuggestions(true)}
                      onKeyDown={(e) => {
                        // Enter on a highlighted suggestion picks it (Base UI);
                        // otherwise Enter adds whatever was typed.
                        if (e.key === 'Enter' && !highlightedTagRef.current && tagInput.trim()) {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        }
                      }}
                      className={styles.TagInput}
                      placeholder="Add tag..."
                    />
                  </div>
                  <AutocompleteContent className={styles.TagPopup}>
                    <AutocompleteList className={styles.TagList}>
                      {(tag: TagMetadata) => (
                        <AutocompleteItem
                          key={tag.name}
                          value={tag}
                          onClick={() => handleAddTag(tag.name)}
                          className={styles.TagSuggestion}
                        >
                          {tag.emoji && <span className={styles.TagSuggestionEmoji}>{tag.emoji}</span>}
                          <span className={styles.TagSuggestionName}>#{tag.name}</span>
                          <div
                            className={styles.TagSuggestionSwatch}
                            style={{ backgroundColor: tag.color }}
                          />
                        </AutocompleteItem>
                      )}
                    </AutocompleteList>
                  </AutocompleteContent>
                </Autocomplete>
              </div>
            </div>

            {/* Rich Content Editor */}
            <div className={styles.Stack2}>
              <RichTextEditor
                content={richContent}
                onChange={handleContentChange}
                onImageUpload={handleContentImageUpload}
              />
            </div>

            {/* To-dos Section — Merlin tasks linked to this card. Only for
                board projects: an idea has nothing to do yet, and a task card
                IS the to-do. Mirrors Merlin's picker, which offers neither. */}
            {showTodos && (
              <div id="section-todos" className={styles.Section}>
                <h2 className={styles.SectionTitle}>To-dos</h2>
                <p className={styles.SectionDescription}>
                  Steps Merlin reminds you about day to day, before the project itself is in progress.
                </p>
                <ProjectTodos cardId={project.id} cardTitle={title} />
              </div>
            )}

            {/* Materials List Section */}
            <div id="section-materials" className={styles.Section}>
              <h2 className={styles.SectionTitle}>Materials List</h2>
              <div className={styles.Stack2}>
                {materialsList.map(item => (
                  <div key={item.id} className={styles.MaterialRow}>
                    {editingMaterialId === item.id ? (
                      <input
                        ref={editingMaterialRef}
                        type="text"
                        value={editingMaterialText}
                        onChange={(e) => setEditingMaterialText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditMaterial();
                          } else if (e.key === 'Escape') {
                            handleCancelEditMaterial();
                          }
                        }}
                        onBlur={handleSaveEditMaterial}
                        className={styles.MaterialEditInput}
                      />
                    ) : (
                      <span 
                        className={cn(
                          styles.MaterialText,
                          item.toBuild && styles.MaterialTextDone
                        )}
                        onDoubleClick={() => handleStartEditMaterial(item.id, item.text)}
                        title="Double-click to edit"
                      >
                        {renderTextWithLinks(item.text)}
                      </span>
                    )}
                    <div className={styles.MaterialControls}>
                      <div className={styles.MaterialToggle}>
                        <Checkbox
                          checked={item.toBuy}
                          onCheckedChange={() => handleUpdateMaterial(item.id, 'toBuy')}
                          className={styles.CheckboxBuy}
                        />
                        <span className={styles.MaterialToggleLabel}>Need to buy</span>
                      </div>
                      <div className={styles.MaterialToggle}>
                        <Checkbox
                          checked={item.toBuild}
                          onCheckedChange={() => handleUpdateMaterial(item.id, 'toBuild')}
                          className={styles.CheckboxOwn}
                        />
                        <span className={styles.MaterialToggleLabel}>Already own</span>
                      </div>
                      <div className={styles.MaterialActions}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={styles.IconButton}
                          onClick={() => handleStartEditMaterial(item.id, item.text)}
                          title="Edit"
                        >
                          <Pencil className={styles.Icon} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={styles.MaterialDelete}
                          onClick={() => handleDeleteMaterial(item.id)}
                          title="Delete"
                        >
                          <Trash2 className={styles.Icon} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className={styles.MaterialAdd}>
                  <textarea
                    value={materialsInput}
                    onChange={(e) => setMaterialsInput(e.target.value)}
                    onPaste={handleMaterialsPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddMaterial();
                      }
                    }}
                    className={styles.MaterialAddInput}
                    placeholder="Add material(s)... (paste list or press Shift+Enter for multiple lines)"
                    rows={1}
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                    onInput={(e) => {
                      // Auto-resize textarea
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                    }}
                  />
                  <Button onClick={handleAddMaterial} size="sm">
                    <Plus className={styles.Icon} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Plans Section */}
            <div 
              id="section-plans" 
              className={cn(
                styles.SectionDroppable,
                isDraggingPlans && styles.SectionDragging
              )}
              onDragOver={handlePlansDragOver}
              onDragLeave={handlePlansDragLeave}
              onDrop={handlePlansDrop}
            >
              <div className={styles.SectionHeader}>
                <h2 className={styles.SectionTitle}>Plans & Sketches</h2>
                {isDraggingPlans && (
                  <p className={styles.DropHint}>
                    Drop files here
                  </p>
                )}
              </div>
              <input
                type="file"
                id="plans-upload"
                className={styles.Hidden}
                multiple
                accept="image/*,.pdf"
                onChange={handlePlansUpload}
              />
              {plans.length === 0 ? (
                <div 
                  className={cn(
                    styles.DropZone,
                    isDraggingPlans && styles.DropZoneActive
                  )}
                  onClick={() => document.getElementById('plans-upload')?.click()}
                >
                  <Upload className={cn(styles.DropZoneIcon, isDraggingPlans && styles.DropZoneIconActive)} />
                  <p>{isDraggingPlans ? "Drop to upload" : "Upload or drag & drop plans, sketches, or PDFs"}</p>
                </div>
              ) : (
                <div className={styles.PlanGrid}>
                  {plans.map(item => (
                    <div key={item.id} className={styles.PlanCard} onClick={() => openAttachment(item.url, item.type, item.name)}>
                      <div className={styles.PlanPreview}>
                        {item.type.startsWith('image/') ? (
                          <Image 
                            src={item.url} 
                            alt={item.name} 
                            fill 
                            className={styles.PlanImage} 
                            unoptimized 
                          />
                        ) : item.type === 'application/pdf' ? (
                          <div className={styles.PlanPdf}>
                            <embed
                              src={`${item.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                              type="application/pdf"
                              className={styles.PlanPdfFrame}
                            />
                            <div className={styles.PlanPdfBadgeWrap}>
                              <span className={styles.PlanPdfBadge}>
                                PDF
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.PlanFile}>
                            <FileText className={styles.PlanFileIcon} />
                            <span className={styles.PlanFileType}>{item.type.split('/')[1] || 'FILE'}</span>
                          </div>
                        )}
                        <div className={styles.PlanOverlay} onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="secondary" className={styles.IconButton} onClick={() => openAttachment(item.url, item.type, item.name)}>
                            <Maximize2 className={styles.Icon} />
                          </Button>
                          <Button size="sm" variant="destructive" className={styles.IconButton} onClick={() => handleRemovePlan(item.id)}>
                            <Trash2 className={styles.Icon} />
                          </Button>
                        </div>
                      </div>
                      <div className={styles.PlanMeta}>
                        <p className={styles.PlanName} title={item.name}>{item.name}</p>
                        <p className={styles.PlanSize}>{(item.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ))}
                  <div 
                    className={cn(
                      styles.PlanAddTile,
                      isDraggingPlans && styles.DropZoneActive
                    )}
                    onClick={() => document.getElementById('plans-upload')?.click()}
                  >
                    <Plus className={cn(styles.DropZoneIcon, styles.PlanAddIcon, isDraggingPlans && styles.DropZoneIconActive)} />
                    <span className={styles.PlanAddLabel}>{isDraggingPlans ? "Drop here" : "Add more"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Inspiration Section */}
            <div 
              ref={inspirationSectionRef}
              id="section-inspiration" 
              className={cn(
                styles.SectionDroppable,
                isDraggingInspiration && styles.SectionDragging,
                !isDraggingInspiration && isHoveringInspiration && styles.SectionHovering
              )}
              onMouseEnter={() => setIsHoveringInspiration(true)}
              onMouseLeave={() => setIsHoveringInspiration(false)}
              onDragOver={handleInspirationDragOver}
              onDragLeave={handleInspirationDragLeave}
              onDrop={handleInspirationDrop}
            >
              <div className={styles.SectionHeader}>
                <h2 className={styles.SectionTitle}>Inspiration</h2>
                <div className={styles.SectionHeaderAside}>
                  {isUploadingInspiration && uploadingInspirationCount > 0 && (
                    <div className={styles.UploadStatus}>
                      <Loader2 className={styles.IconSpin} />
                      <span>Uploading {uploadingInspirationCount} image{uploadingInspirationCount > 1 ? 's' : ''}...</span>
                    </div>
                  )}
                  {isDraggingInspiration && (
                    <p className={styles.DropHint}>
                      Drop files here
                    </p>
                  )}
                  {!isDraggingInspiration && isHoveringInspiration && !isUploadingInspiration && (
                    <p className={styles.PasteHint}>
                      Paste from clipboard (Ctrl+V)
                    </p>
                  )}
                </div>
              </div>
              <input
                type="file"
                id="inspiration-upload"
                className={styles.Hidden}
                multiple
                accept="image/*"
                onChange={handleInspirationUpload}
              />
              {inspiration.length === 0 ? (
                <div
                  className={cn(
                    styles.DropZone,
                    isDraggingInspiration && styles.DropZoneActive
                  )}
                  onClick={() => document.getElementById('inspiration-upload')?.click()}
                >
                  <Sparkles className={cn(styles.DropZoneIcon, isDraggingInspiration && styles.DropZoneIconActive)} />
                  <p>{isDraggingInspiration ? "Drop to upload" : "Upload or drag & drop inspiration images"}</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Swipeable Carousel */}
                  <div className={styles.MobileOnly}>
                    <div 
                      ref={inspirationScrollRef}
                      onScroll={handleInspirationScroll}
                      className={cn(styles.Carousel, "scrollbar-hide")}
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {inspiration.map(item => (
                        <div 
                          key={item.id} 
                          className={styles.CarouselSlide}
                        >
                          <div 
                            className={styles.CarouselCard} 
                          >
                            {item.type.startsWith('image/') ? (
                              <div
                                className={styles.CarouselImageButton}
                                onClick={() => {
                                  console.log('Mobile carousel IMAGE WRAPPER clicked!', item);
                                  openInspirationLightbox(item);
                                }}
                              >
                                <Image 
                                  src={item.url} 
                                  alt={item.name} 
                                  fill
                                  className={styles.CarouselImage} 
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div 
                                className={styles.CarouselFile}
                                onClick={() => {
                                  console.log('Mobile carousel FILE clicked!', item);
                                  openInspirationLightbox(item);
                                }}
                              >
                                <FileText className={styles.FileIconLg} />
                              </div>
                            )}
                            {/* Quick action buttons on long press - Mobile */}
                            <div className={styles.CarouselActions} onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className={styles.CarouselActionButton} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetInspirationAsCover(item.url);
                                }}
                              >
                                <ImageIcon className={styles.IconLeadingSm} />
                                Cover
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className={styles.CarouselActionButton} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveInspiration(item.id);
                                }}
                              >
                                <Trash2 className={styles.IconLeadingSm} />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className={styles.CarouselSlide}>
                        <div className={styles.CarouselAddTile} onClick={() => document.getElementById('inspiration-upload')?.click()}>
                          <Plus className={styles.CarouselAddIcon} />
                          <span className={styles.CarouselAddLabel}>Add more</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Pagination Dots */}
                    <div className={styles.CarouselDots}>
                      {[...inspiration, { id: 'add-more' }].map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToInspirationIndex(index)}
                          className={cn(
                            styles.CarouselDot,
                            currentInspirationIndex === index 
                              ? styles.CarouselDotActive 
                              : styles.CarouselDotInactive
                          )}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Desktop: Masonry Grid */}
                  <div className={styles.DesktopOnly}>
                    <div className={styles.Masonry}>
                      {inspiration.map(item => (
                        <div 
                          key={item.id} 
                          className={styles.MasonryCard} 
                        >
                          {item.type.startsWith('image/') ? (
                            <div
                              className={styles.MasonryImageButton}
                              onClick={() => {
                                console.log('Desktop grid IMAGE clicked!', item);
                                openInspirationLightbox(item);
                              }}
                            >
                              <Image 
                                src={item.url} 
                                alt={item.name} 
                                width={400}
                                height={400}
                                className={styles.MasonryImage} 
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div 
                              className={styles.MasonryFile}
                              onClick={() => {
                                console.log('Desktop grid FILE clicked!', item);
                                openInspirationLightbox(item);
                              }}
                            >
                              <FileText className={styles.FileIconMd} />
                            </div>
                          )}
                          {/* Hover overlay - pointer-events-none when hidden, only buttons are clickable */}
                          <div className={styles.MasonryOverlay}>
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className={styles.MasonryOverlayButton} 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetInspirationAsCover(item.url);
                              }}
                              title="Set as cover"
                            >
                              <Images className={styles.Icon} />
                            </Button>
                            {item.type.startsWith('image/') && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className={styles.MasonryOverlayButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCropInspirationItem({ id: item.id, url: item.url });
                                }}
                                title="Crop image"
                              >
                                <Crop className={styles.Icon} />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className={styles.MasonryOverlayButton} 
                              onClick={(e) => {
                                e.stopPropagation();
                                openInspirationLightbox(item);
                              }}
                              title="View full size"
                            >
                              <Maximize2 className={styles.Icon} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className={styles.MasonryOverlayButton} 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveInspiration(item.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 className={styles.Icon} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div
                        className={cn(
                          styles.MasonryAddTile,
                          isDraggingInspiration && styles.DropZoneActive
                        )}
                        onClick={() => document.getElementById('inspiration-upload')?.click()}
                      >
                        <Plus className={cn(styles.DropZoneIcon, styles.MasonryAddIcon, isDraggingInspiration && styles.DropZoneIconActive)} />
                        <span className={styles.MasonryAddLabel}>{isDraggingInspiration ? "Drop here" : "Add"}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Delete link — inside the scroll area, below all content */}
            {isModal && (
              <div className={styles.DangerZone}>
                <button
                  onClick={handleToggleArchived}
                  className={styles.ArchiveLink}
                >
                  {isArchived ? 'Unarchive Project' : 'Archive Project'}
                </button>
                <button
                  onClick={handleDeleteProject}
                  className={styles.DeleteLink}
                >
                  Delete Project
                </button>
              </div>
            )}

            {/* Footer (Modal only) */}
            {isModal && onClose && (
              <div className={styles.Footer}>
                {isSaving ? (
                  <p className={styles.FooterSaving}>Saving...</p>
                ) : (
                  <div className={styles.FooterActions}>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleToggleCompleted}
                      className={cn(
                        isCompleted && styles.CompleteButtonDone
                      )}
                      title={isCompleted ? "Click to mark as incomplete" : "Mark as complete"}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className={styles.CompletedIcon} />
                          <Circle className={styles.IncompleteIcon} />
                          <span className={styles.CompletedLabel}>Completed</span>
                          <span className={styles.IncompleteLabel}>Mark Incomplete</span>
                        </>
                      ) : (
                        <><Circle className={styles.IconLeading} />Mark Complete</>
                      )}
                    </Button>
                    <Button onClick={handleClose} size="lg">
                      Done
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
      
      {/* Lightbox for inspiration images */}
      <Lightbox
        items={lightboxItems}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onDelete={handleRemoveInspiration}
        onSetAsCover={handleSetInspirationAsCover}
        showDeleteButton={true}
        showSetCoverButton={true}
      />

      {/* Cover image crop modal */}
      {imageUrl && (
        <ImageCropModal
          imageUrl={imageUrl}
          isOpen={isCropOpen}
          onClose={() => setIsCropOpen(false)}
          upload={uploadImageBase64}
          onSave={async (newUrl) => {
            setImageUrl(newUrl);
            await updateProject(project.id, { imageUrl: newUrl });
          }}
        />
      )}

      {/* Inspiration image crop modal */}
      {cropInspirationItem && (
        <ImageCropModal
          imageUrl={cropInspirationItem.url}
          isOpen={!!cropInspirationItem}
          onClose={() => setCropInspirationItem(null)}
          upload={uploadImageBase64}
          onSave={async (newUrl) => {
            const oldUrl = cropInspirationItem.url;
            const newInspiration = inspiration.map(item =>
              item.id === cropInspirationItem.id ? { ...item, url: newUrl } : item
            );
            setInspiration(newInspiration);
            const updateData: Record<string, unknown> = { inspiration: newInspiration };
            if (imageUrl === oldUrl) {
              setImageUrl(newUrl);
              updateData.imageUrl = newUrl;
            }
            await updateProject(project.id, updateData);
          }}
        />
      )}
    </div>
  );
}

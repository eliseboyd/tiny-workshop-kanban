'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Project } from './KanbanBoard';
import { updateProject, generateProjectImage, uploadImageBase64, uploadFile, getAllProjectGroups, getAllTags, ensureTagExists, moveProjectFromDoneIfNeeded, fetchAndSetOgImage } from '@/app/actions';
import Image from 'next/image';
import { Loader2, Sparkles, Trash2, Upload, Image as ImageIcon, X, FileText, Maximize2, ChevronLeft, ChevronRight, Plus, Images, ExternalLink, Pencil, FolderKanban, ListTodo, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbox, type LightboxItem } from '@/components/ui/lightbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { compressImage } from '@/utils/image-compression';

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(() => import('@/components/ui/pdf-viewer').then(mod => ({ default: mod.PDFViewer })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-white">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
});

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
          className="text-primary hover:underline inline-flex items-center gap-0.5 break-all"
        >
          {part.length > 50 ? part.slice(0, 50) + '...' : part}
          <ExternalLink className="h-3 w-3 inline flex-shrink-0" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type TagMetadata = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type ProjectEditorProps = {
  project: Project;
  onClose?: () => void;
  isModal?: boolean;
  className?: string;
};

export function ProjectEditor({ project, onClose, isModal = false, className }: ProjectEditorProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingOgImage, setIsFetchingOgImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingPlans, setIsDraggingPlans] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInspiration, setIsUploadingInspiration] = useState(false);
  const [uploadingInspirationCount, setUploadingInspirationCount] = useState(0);
  const [showInspirationPicker, setShowInspirationPicker] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  
  // Simple local state for immediate UI updates
  const [title, setTitle] = useState(project.title);
  const [imageUrl, setImageUrl] = useState(project.imageUrl || '');
  const [richContent, setRichContent] = useState(project.richContent || '');
  const [tags, setTags] = useState<string[]>(project.tags || []);
  const [parentProjectId, setParentProjectId] = useState<string | null>(project.parentProjectId || null);
  const [isTask, setIsTask] = useState<boolean>(project.isTask || false);
  const [isCompleted, setIsCompleted] = useState<boolean>(project.isCompleted || false);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [allTags, setAllTags] = useState<TagMetadata[]>([]);
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
          
          router.refresh();
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
  }, [project.id, router]);
  
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
    setAllTags(tagsData);
    
    router.refresh();
  };
  
  const handleRemoveTag = async (tag: string) => {
    const newTags = tags.filter(t => t !== tag);
    setTags(newTags);
    await updateProject(project.id, { tags: newTags });
    router.refresh();
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

  // Project group handler
  const handleProjectGroupChange = async (groupId: string) => {
    const newGroupId = groupId === 'none' ? null : groupId;
    setParentProjectId(newGroupId);
    await updateProject(project.id, { parent_project_id: newGroupId });
    router.refresh();
  };
  
  // Task type handler
  const handleToggleTaskType = async () => {
    const newIsTask = !isTask;
    setIsTask(newIsTask);
    await updateProject(project.id, { is_task: newIsTask });
    router.refresh();
  };
  
  // Completed status handler
  const handleToggleCompleted = async () => {
    const newIsCompleted = !isCompleted;
    setIsCompleted(newIsCompleted);
    await updateProject(project.id, { is_completed: newIsCompleted });
    router.refresh();
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
    
    router.refresh();
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
      router.refresh();
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
    router.refresh();
  };
  
  const handleDeleteMaterial = async (id: string) => {
    const newList = materialsList.filter(item => item.id !== id);
    setMaterialsList(newList);
    await updateProject(project.id, { materialsList: newList });
    router.refresh();
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
    router.refresh();
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
      router.refresh();
    } catch (error) {
      console.error('Failed to upload plans', error);
    }
    if (e.target) e.target.value = '';
  };
  
  const handleRemovePlan = async (id: string) => {
    const newPlans = plans.filter(item => item.id !== id);
    setPlans(newPlans);
    await updateProject(project.id, { plans: newPlans });
    router.refresh();
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
      const updateData: any = { inspiration: newInspiration };
      if (files.length === 1 && !imageUrl && newAttachments[0]) {
        setImageUrl(newAttachments[0].url);
        updateData.imageUrl = newAttachments[0].url;
      }
      
      await updateProject(project.id, updateData);
      router.refresh();
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
    
    router.refresh();
  };
  
  const handleSetInspirationAsCover = async (url: string) => {
    setImageUrl(url);
    await updateProject(project.id, { imageUrl: url });
    router.refresh();
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
      router.refresh();
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
    
    router.refresh();
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
              const updateData: any = { inspiration: newInspiration };
              if (!imageUrl) {
                setImageUrl(result.url);
                updateData.imageUrl = result.url;
              }
              
              await updateProject(project.id, updateData);
              router.refresh();
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
  
  const handleGenerateImage = async () => {
    if (!title) return;
    setIsGenerating(true);
    try {
      const generatedUrl = await generateProjectImage({ title, description: richContent });
      setImageUrl(generatedUrl);
      
      // Create attachment object for generated image
      const generatedAttachment = {
        id: `generated-${Date.now()}`,
        url: generatedUrl,
        name: `${title} - AI Generated`,
        type: 'image/png',
        size: 0 // Size unknown for generated images
      };
      
      // Also add to inspiration
      const newInspiration = [...inspiration, generatedAttachment];
      setInspiration(newInspiration);
      
      await updateProject(project.id, { 
        imageUrl: generatedUrl,
        inspiration: newInspiration 
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to generate image', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFetchOgImage = async () => {
    setIsFetchingOgImage(true);
    try {
      const result = await fetchAndSetOgImage(project.id);
      if (result.success && result.imageUrl) {
        setImageUrl(result.imageUrl);
        router.refresh();
      } else {
        alert(result.error || 'Could not find an image from the links in your project');
      }
    } catch (err) {
      console.error('Failed to fetch OG image:', err);
      alert('Failed to fetch image from link');
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
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to upload plans via drag and drop', error);
    }
  };
  
  // Section navigation
  const scrollToSection = (section: string) => {
    setActiveSection(section);
    document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['overview', 'materials', 'plans', 'inspiration'];
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

  // Load project groups and tags
  useEffect(() => {
    const loadData = async () => {
      const [groups, tagsData] = await Promise.all([
        getAllProjectGroups(),
        getAllTags(),
      ]);
      setProjectGroups(groups);
      setAllTags(tagsData);
    };
    loadData();
  }, []);
  
  // Sync local state when project prop changes (e.g., after router.refresh())
  useEffect(() => {
    setIsTask(project.isTask || false);
  }, [project.isTask]);
  
  useEffect(() => {
    setIsCompleted(project.isCompleted || false);
  }, [project.isCompleted]);
  
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
    <div className={cn("flex h-full bg-background relative", className)}>
      {/* Swipe Back Indicator - Fixed position, outside scroll */}
      {swipeProgress > 0 && (
        <>
          {/* Edge Indicator */}
          <div 
            className="fixed left-0 top-0 bottom-0 w-1 bg-primary z-50 pointer-events-none"
            style={{ 
              opacity: swipeProgress,
              transform: `scaleY(${swipeProgress})`,
              transformOrigin: 'center'
            }}
          />
          {/* Text Indicator */}
          <div 
            className="fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
            style={{ 
              opacity: swipeProgress,
              transform: `translateX(${swipeProgress * 20 - 20}px)`
            }}
          >
            <div className="bg-primary/90 backdrop-blur-sm rounded-r-full p-4 pr-8 flex items-center gap-2 shadow-lg">
              <ChevronLeft className="h-7 w-7 text-primary-foreground" />
              <span className="text-base font-semibold text-primary-foreground">Back</span>
            </div>
          </div>
        </>
      )}
      
      {/* Sidebar (Desktop only) */}
      <div className="hidden md:flex w-48 flex-col gap-1 p-6 border-r pt-24 sticky top-0 h-screen shrink-0">
        <div className="font-semibold mb-4 px-2 text-sm text-muted-foreground uppercase tracking-wider">
          Contents
        </div>
        <button onClick={() => scrollToSection('overview')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'overview' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>
          Project Overview
        </button>
        <button onClick={() => scrollToSection('materials')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'materials' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>
          Materials List
        </button>
        <button onClick={() => scrollToSection('plans')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'plans' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>
          Plans
        </button>
        <button onClick={() => scrollToSection('inspiration')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'inspiration' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>
          Inspiration
        </button>
        
        {isSaving && (
          <div className="mt-auto pt-4 border-t text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* Main Content Wrapper */}
      <div 
        className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative editor-scroll-container"
        style={{
          transform: swipeProgress > 0 ? `translateX(${swipeProgress * 50}px)` : 'none',
          transition: swipeProgress === 0 ? 'transform 0.2s ease-out' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Header / Cover Image */}
        <div className="relative group/cover">
          <div 
            ref={imageAreaRef}
            className={cn(
              "relative w-full h-48 bg-dots bg-muted/30 flex items-center justify-center overflow-hidden group transition-colors border-b",
              isDragging && "bg-muted/50 border-2 border-dashed border-primary",
              !imageUrl && "md:hover:bg-muted/40 md:cursor-pointer",
              isHoveringCover && "ring-2 ring-primary/50"
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
              className="hidden" 
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
            
            {isGenerating && !imageUrl ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Creating your cover image...</p>
              </div>
            ) : isUploadingCover ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Uploading image...</p>
              </div>
            ) : imageUrl ? (
              <>
                <Image
                  src={imageUrl}
                  alt="Project cover"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Change Cover
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                <ImageIcon className="h-8 w-8 opacity-50" />
                <p className="text-sm">Click to upload or drag & drop</p>
                <p className="text-xs opacity-75 hidden md:block">Hover and paste (Ctrl+V) to upload from clipboard</p>
              </div>
            )}
          </div>
          
          {/* Navigation / Actions Header */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            {/* Back Button (Full Page) */}
            {!isModal && (
              <>
                {isSaving ? (
                  <span className="text-sm text-muted-foreground px-3 py-2 bg-background/80 backdrop-blur-sm rounded-md">Saving...</span>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90 gap-1"
                    onClick={handleBack}
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
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
                  className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90 gap-1"
                  title="Open in full view"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Open as Page</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Action Buttons */}
          {/* Mobile: Buttons at bottom */}
          <div className="md:hidden absolute bottom-4 left-4 right-4 flex gap-2 z-20">
            {imageUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 bg-background/90 backdrop-blur-sm hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveCover();
                }}
                title="Remove Cover"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1 h-9 bg-background/90 backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isGenerating}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1 h-9 bg-background/90 backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateImage();
              }}
              disabled={isGenerating || !title}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Create with AI
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1 h-9 bg-background/90 backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                handleFetchOgImage();
              }}
              disabled={isFetchingOgImage}
              title="Fetch image from links in project"
            >
              {isFetchingOgImage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              From Link
            </Button>
            {inspiration.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 bg-background/90 backdrop-blur-sm hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInspirationPicker(!showInspirationPicker);
                }}
              >
                <Images className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Desktop: Buttons at bottom right */}
          <div className={cn(
            "hidden md:flex absolute bottom-4 right-4 gap-2 z-20 transition-opacity",
            imageUrl && "opacity-0 group-hover:opacity-100"
          )}>
            {imageUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveCover();
                }}
                title="Remove Cover"
              >
                <X className="h-3 w-3" />
                <span className="ml-2">Remove</span>
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateImage();
              }}
              disabled={isGenerating || !title}
              title="Generate AI Cover"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              <span className="ml-2">Generate Cover</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={(e) => {
                e.stopPropagation();
                handleFetchOgImage();
              }}
              disabled={isFetchingOgImage}
              title="Fetch image from links in project"
            >
              {isFetchingOgImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
              <span className="ml-2">From Link</span>
            </Button>
            {inspiration.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInspirationPicker(!showInspirationPicker);
                }}
                title="Choose from Inspiration"
              >
                <Images className="h-3 w-3" />
                <span className="ml-2">From Inspiration</span>
              </Button>
            )}
          </div>

          {/* Inspiration Picker */}
          {showInspirationPicker && inspiration.length > 0 && (
            <div 
              className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={(e) => {
                e.stopPropagation();
                setShowInspirationPicker(false);
              }}
            >
              <div 
                className="bg-background rounded-lg p-4 max-w-md w-full max-h-[80%] overflow-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Choose from Inspiration</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowInspirationPicker(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {inspiration.filter(item => item.type.startsWith('image/')).map(item => (
                    <button
                      key={item.id}
                      className={cn(
                        "relative aspect-square rounded-md overflow-hidden border-2 transition-all hover:border-primary",
                        imageUrl === item.url ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                      )}
                      onClick={async () => {
                        setImageUrl(item.url);
                        await updateProject(project.id, { imageUrl: item.url });
                        setShowInspirationPicker(false);
                        router.refresh();
                      }}
                    >
                      <Image
                        src={item.url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {imageUrl === item.url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {inspiration.filter(item => item.type.startsWith('image/')).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No images in inspiration yet
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 sm:p-10">
          {viewingAttachment ? (
            /* Attachment Viewer */
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              {/* Viewer Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeAttachment}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Project
                </Button>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {allViewableItems.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateAttachment('prev')}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span>
                        {allViewableItems.findIndex(item => item.url === viewingAttachment.url) + 1} / {allViewableItems.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateAttachment('next')}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                
                <h2 className="font-medium truncate max-w-md">{viewingAttachment.name}</h2>
              </div>
              
              {/* Viewer Content */}
              <div className="flex-1 min-h-0">
                {viewingAttachment.type.startsWith('image/') ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted/10 rounded-lg">
                    <Image
                      src={viewingAttachment.url}
                      alt={viewingAttachment.name}
                      width={1920}
                      height={1080}
                      className="max-w-full max-h-full object-contain"
                      unoptimized
                    />
                  </div>
                ) : viewingAttachment.type === 'application/pdf' ? (
                  <div className="w-full h-full">
                    <PDFViewer url={viewingAttachment.url} fileName={viewingAttachment.name} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                    <FileText className="h-16 w-16 opacity-50" />
                    <p className="text-lg">{viewingAttachment.name}</p>
                    <a 
                      href={viewingAttachment.url} 
                      download 
                      className="text-primary hover:underline"
                    >
                      Download file
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-8 w-full px-4 sm:px-0">
            {/* Title Section */}
            <div id="section-overview" className="space-y-2">
              <textarea
                value={title}
                onChange={(e) => {
                  handleTitleChange(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                className="w-full text-xl md:text-2xl font-bold font-sans tracking-tight bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 overflow-hidden leading-tight"
                placeholder="Untitled"
                rows={1}
                style={{ height: 'auto' }}
              />
              
              {/* Task/Project Type Toggle */}
              <div className="flex items-center gap-2 pb-2">
                <button
                  onClick={handleToggleTaskType}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                    isTask 
                      ? "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" 
                      : "bg-violet-500/10 text-violet-600 hover:bg-violet-500/20"
                  )}
                  title={isTask ? "Switch to Project" : "Switch to Task"}
                >
                  {isTask ? (
                    <>
                      <ListTodo className="h-4 w-4" />
                      <span>Task</span>
                    </>
                  ) : (
                    <>
                      <FolderKanban className="h-4 w-4" />
                      <span>Project</span>
                    </>
                  )}
                </button>
                
                {/* Completed Status Toggle */}
                <button
                  onClick={handleToggleCompleted}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ml-auto",
                    isCompleted 
                      ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                >
                  {isCompleted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4" />
                      <span>Mark Complete</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* Project Group Selector */}
              <div className="flex items-center gap-3 pb-2">
                <label className="text-sm text-muted-foreground min-w-[80px]">Project:</label>
                <Select value={parentProjectId || 'none'} onValueChange={handleProjectGroupChange}>
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">None</span>
                    </SelectItem>
                    {projectGroups.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Create project groups in Settings
                      </div>
                    ) : (
                      projectGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          <div className="flex items-center gap-2">
                            {group.emoji && <span>{group.emoji}</span>}
                            <span>{group.name}</span>
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: group.color }}
                            />
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags Row */}
              <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
                {tags.map(tag => {
                  const tagMeta = allTags.find(t => t.name === tag);
                  return (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className="gap-1 pr-1 text-sm font-normal transition-all"
                      style={{
                        backgroundColor: tagMeta?.color ? `${tagMeta.color}20` : undefined,
                        borderColor: tagMeta?.color || undefined,
                        color: tagMeta?.color || undefined,
                      }}
                    >
                      {tagMeta?.icon ? (
                        <div className="relative w-4 h-4 flex-shrink-0">
                          <Image
                            src={tagMeta.icon}
                            alt={tag}
                            width={16}
                            height={16}
                            className="rounded object-cover"
                            unoptimized
                          />
                        </div>
                      ) : tagMeta?.emoji ? (
                        <span>{tagMeta.emoji}</span>
                      ) : null}
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-70 rounded-full p-0.5 ml-1 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                <div className="relative min-w-[120px]">
                  <input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowTagSuggestions(true);
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    className="w-full text-sm bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/30"
                    placeholder="Add tag..."
                  />
                  {showTagSuggestions && tagSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-50 min-w-[200px] max-w-[300px]">
                      {tagSuggestions.map(tag => (
                        <button
                          key={tag.name}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                          onClick={() => handleAddTag(tag.name)}
                        >
                          {tag.emoji && <span className="text-base">{tag.emoji}</span>}
                          <span className="flex-1">#{tag.name}</span>
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: tag.color }}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rich Content Editor */}
            <div className="space-y-2">
              <RichTextEditor
                content={richContent}
                onChange={handleContentChange}
                onImageUpload={handleContentImageUpload}
              />
            </div>

            {/* Materials List Section */}
            <div id="section-materials" className="space-y-4 pt-8 border-t">
              <h2 className="text-2xl font-bold">Materials List</h2>
              <div className="space-y-2">
                {materialsList.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors group">
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
                        className="flex-1 bg-background px-2 py-1 rounded border border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <span 
                        className={cn(
                          "flex-1 cursor-text px-2 py-1 rounded transition-colors",
                          item.toBuild && "line-through text-muted-foreground"
                        )}
                        onDoubleClick={() => handleStartEditMaterial(item.id, item.text)}
                        title="Double-click to edit"
                      >
                        {renderTextWithLinks(item.text)}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={item.toBuy}
                          onCheckedChange={() => handleUpdateMaterial(item.id, 'toBuy')}
                          className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Need to buy</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={item.toBuild}
                          onCheckedChange={() => handleUpdateMaterial(item.id, 'toBuild')}
                          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Already own</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleStartEditMaterial(item.id, item.text)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:text-destructive"
                          onClick={() => handleDeleteMaterial(item.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
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
                    className="flex-1 px-3 py-2 rounded-md border bg-background text-sm resize-none"
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
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Plans Section */}
            <div 
              id="section-plans" 
              className={cn(
                "space-y-4 pt-8 border-t rounded-lg transition-all",
                isDraggingPlans && "ring-2 ring-primary/50 bg-primary/5 p-4 -m-4"
              )}
              onDragOver={handlePlansDragOver}
              onDragLeave={handlePlansDragLeave}
              onDrop={handlePlansDrop}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Plans & Sketches</h2>
                {isDraggingPlans && (
                  <p className="text-xs text-primary font-medium">
                    Drop files here
                  </p>
                )}
              </div>
              <input
                type="file"
                id="plans-upload"
                className="hidden"
                multiple
                accept="image/*,.pdf"
                onChange={handlePlansUpload}
              />
              {plans.length === 0 ? (
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center gap-2 hover:bg-muted/10 transition-colors cursor-pointer",
                    isDraggingPlans && "border-primary bg-primary/10"
                  )}
                  onClick={() => document.getElementById('plans-upload')?.click()}
                >
                  <Upload className={cn("h-8 w-8 opacity-50", isDraggingPlans && "text-primary opacity-100")} />
                  <p>{isDraggingPlans ? "Drop to upload" : "Upload or drag & drop plans, sketches, or PDFs"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {plans.map(item => (
                    <div key={item.id} className="group relative border rounded-lg overflow-hidden bg-background hover:shadow-md transition-all cursor-pointer" onClick={() => openAttachment(item.url, item.type, item.name)}>
                      <div className="aspect-[3/2] relative bg-muted/20 overflow-hidden">
                        {item.type.startsWith('image/') ? (
                          <Image 
                            src={item.url} 
                            alt={item.name} 
                            fill 
                            className="object-contain p-2" 
                            unoptimized 
                          />
                        ) : item.type === 'application/pdf' ? (
                          <div className="w-full h-full relative">
                            <embed
                              src={`${item.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                              type="application/pdf"
                              className="w-full h-full pointer-events-none"
                            />
                            <div className="absolute bottom-2 right-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider bg-red-600 text-white px-2 py-0.5 rounded">
                                PDF
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4">
                            <FileText className="h-12 w-12 mb-2 opacity-50" />
                            <span className="text-xs uppercase font-bold tracking-wider">{item.type.split('/')[1] || 'FILE'}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => openAttachment(item.url, item.type, item.name)}>
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => handleRemovePlan(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-3 border-t bg-muted/5">
                        <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                        <p className="text-xs text-muted-foreground">{(item.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ))}
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/10 cursor-pointer min-h-[200px]",
                      isDraggingPlans && "border-primary bg-primary/10"
                    )}
                    onClick={() => document.getElementById('plans-upload')?.click()}
                  >
                    <Plus className={cn("h-8 w-8 opacity-50 mb-2", isDraggingPlans && "text-primary opacity-100")} />
                    <span className="text-sm">{isDraggingPlans ? "Drop here" : "Add more"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Inspiration Section */}
            <div 
              ref={inspirationSectionRef}
              id="section-inspiration" 
              className={cn(
                "space-y-4 pt-8 border-t rounded-lg transition-all",
                isHoveringInspiration && "ring-2 ring-primary/30 bg-muted/20 p-4 -m-4"
              )}
              onMouseEnter={() => setIsHoveringInspiration(true)}
              onMouseLeave={() => setIsHoveringInspiration(false)}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Inspiration</h2>
                <div className="flex items-center gap-3">
                  {isUploadingInspiration && uploadingInspirationCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading {uploadingInspirationCount} image{uploadingInspirationCount > 1 ? 's' : ''}...</span>
                    </div>
                  )}
                  {isHoveringInspiration && !isUploadingInspiration && (
                    <p className="text-xs text-muted-foreground hidden md:block">
                      Paste from clipboard (Ctrl+V)
                    </p>
                  )}
                </div>
              </div>
              <input
                type="file"
                id="inspiration-upload"
                className="hidden"
                multiple
                accept="image/*"
                onChange={handleInspirationUpload}
              />
              {inspiration.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center gap-2 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => document.getElementById('inspiration-upload')?.click()}>
                  <Sparkles className="h-8 w-8 opacity-50" />
                  <p>Add inspiration images</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Swipeable Carousel */}
                  <div className="md:hidden">
                    <div 
                      ref={inspirationScrollRef}
                      onScroll={handleInspirationScroll}
                      className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 -mx-4 px-4"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {inspiration.map(item => (
                        <div 
                          key={item.id} 
                          className="flex-shrink-0 w-full snap-center"
                        >
                          <div 
                            className="group relative rounded-lg overflow-hidden bg-muted/20 cursor-pointer aspect-[4/3]" 
                            onClick={() => {
                              console.log('Mobile carousel clicked!', item);
                              openInspirationLightbox(item);
                            }}
                          >
                            {item.type.startsWith('image/') ? (
                              <Image 
                                src={item.url} 
                                alt={item.name} 
                                fill
                                className="object-contain" 
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                                <FileText className="h-12 w-12" />
                              </div>
                            )}
                            {/* Quick action buttons on long press - Mobile */}
                            <div className="absolute bottom-2 left-2 right-2 opacity-0 active:opacity-100 transition-opacity flex gap-2 md:hidden" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="flex-1 h-9" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetInspirationAsCover(item.url);
                                }}
                              >
                                <ImageIcon className="h-4 w-4 mr-1" />
                                Cover
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="flex-1 h-9" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveInspiration(item.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex-shrink-0 w-full snap-center">
                        <div className="border-2 border-dashed rounded-lg aspect-[4/3] flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/10 cursor-pointer" onClick={() => document.getElementById('inspiration-upload')?.click()}>
                          <Plus className="h-12 w-12 opacity-50 mb-2" />
                          <span className="text-sm">Add more</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Pagination Dots */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                      {[...inspiration, { id: 'add-more' }].map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToInspirationIndex(index)}
                          className={cn(
                            "h-2 rounded-full transition-all",
                            currentInspirationIndex === index 
                              ? "w-6 bg-primary" 
                              : "w-2 bg-muted-foreground/30"
                          )}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Desktop: Masonry Grid */}
                  <div className="hidden md:block">
                    <div className="columns-2 sm:columns-3 gap-4 space-y-4">
                      {inspiration.map(item => (
                        <div 
                          key={item.id} 
                          className="break-inside-avoid group relative rounded-lg overflow-hidden bg-muted/20 mb-4 cursor-pointer" 
                          onClick={() => {
                            console.log('Desktop grid clicked!', item);
                            openInspirationLightbox(item);
                          }}
                        >
                          {item.type.startsWith('image/') ? (
                            <Image 
                              src={item.url} 
                              alt={item.name} 
                              width={400}
                              height={400}
                              className="w-full h-auto object-cover" 
                              unoptimized
                            />
                          ) : (
                            <div className="aspect-square flex items-center justify-center bg-muted text-muted-foreground">
                              <FileText className="h-8 w-8" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="h-8 w-8 p-0" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetInspirationAsCover(item.url);
                              }}
                              title="Set as cover"
                            >
                              <Images className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="h-8 w-8 p-0" 
                              onClick={(e) => {
                                e.stopPropagation();
                                openInspirationLightbox(item);
                              }}
                              title="View full size"
                            >
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="h-8 w-8 p-0" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveInspiration(item.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="break-inside-avoid border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/10 cursor-pointer" onClick={() => document.getElementById('inspiration-upload')?.click()}>
                        <Plus className="h-8 w-8 opacity-50 mb-1" />
                        <span className="text-xs">Add</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Done Button (Modal only) */}
            {isModal && onClose && (
              <div className="flex justify-end pt-8 pb-4 sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent">
                {isSaving ? (
                  <p className="text-sm text-muted-foreground px-4 py-2">Saving...</p>
                ) : (
                  <Button onClick={handleClose} size="lg">
                    Done
                  </Button>
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
    </div>
  );
}

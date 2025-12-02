'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Project } from './KanbanBoard';
import { updateProject, generateProjectImage, uploadImageBase64, uploadFile } from '@/app/actions';
import Image from 'next/image';
import { Loader2, Sparkles, Trash2, Upload, Image as ImageIcon, X, FileText, Maximize2, ChevronLeft, ChevronRight, Plus, Images } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

type ProjectEditorProps = {
  project: Project;
  existingTags?: string[];
  onClose?: () => void;
  isModal?: boolean;
  className?: string;
};

export function ProjectEditor({ project, existingTags = [], onClose, isModal = false, className }: ProjectEditorProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  
  // Simple local state for immediate UI updates
  const [title, setTitle] = useState(project.title);
  const [imageUrl, setImageUrl] = useState(project.imageUrl || '');
  const [richContent, setRichContent] = useState(project.richContent || '');
  const [tags, setTags] = useState<string[]>(project.tags || []);
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Open attachment viewer inline
  const openAttachment = (url: string, type: string, name: string) => {
    // Open image in new tab natively
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
  
  // Immediate save function (no debounce)
  const immediatelySave = useCallback(async (data: Partial<Project>) => {
    try {
      await updateProject(project.id, data);
      pendingChangesRef.current = null;
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
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
      try {
        await updateProject(project.id, data);
        pendingChangesRef.current = null;
        router.refresh();
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setIsSaving(false);
      }
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
  
  // Rich content handler
  const handleContentChange = (content: string) => {
    setRichContent(content);
    debouncedSave({ richContent: content });
  };
  
  // Tags handlers
  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed || tags.includes(trimmed)) return;
    const newTags = [...tags, trimmed];
    setTags(newTags);
    updateProject(project.id, { tags: newTags });
    setTagInput('');
    setShowTagSuggestions(false);
  };
  
  const handleRemoveTag = (tag: string) => {
    const newTags = tags.filter(t => t !== tag);
    setTags(newTags);
    updateProject(project.id, { tags: newTags });
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
    
    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append('file', file);
        const result = await uploadFile(fd);
        newAttachments.push(result);
      }
      const newInspiration = [...inspiration, ...newAttachments];
      setInspiration(newInspiration);
      await updateProject(project.id, { inspiration: newInspiration });
      router.refresh();
    } catch (error) {
      console.error('Failed to upload inspiration', error);
    }
    if (e.target) e.target.value = '';
  };
  
  const handleRemoveInspiration = async (id: string) => {
    const newInspiration = inspiration.filter(item => item.id !== id);
    setInspiration(newInspiration);
    await updateProject(project.id, { inspiration: newInspiration });
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
    try {
      const fd = new FormData();
      fd.append('file', file);
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
    }
  };
  
  const handleRemoveCover = async () => {
    setImageUrl('');
    await updateProject(project.id, { imageUrl: null });
    router.refresh();
  };
  
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
  
  // Swipe back gesture for mobile with visual feedback
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const scrollTopAtStart = useRef(0);
  const [swipeProgress, setSwipeProgress] = useState(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    // Track scroll position at start
    const container = e.currentTarget as HTMLElement;
    scrollTopAtStart.current = container.scrollTop;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    const container = e.currentTarget as HTMLElement;
    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    const diffX = touchCurrentX - touchStartX.current;
    const diffY = touchCurrentY - touchStartY.current;
    
    // Enable swipe-back if:
    // 1. Swiping right (diffX > 0)
    // 2. At or near top of scroll (< 50px tolerance)
    // 3. More horizontal than vertical movement
    if (diffX > 0 && 
        container.scrollTop < 50 &&
        scrollTopAtStart.current < 50 &&
        diffX > Math.abs(diffY) * 0.5) {
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
    // 2. More horizontal than vertical (with tolerance)
    // 3. Near top of page (< 50px scroll)
    if (diffX > 100 && 
        diffX > Math.abs(diffY) * 0.5 &&
        scrollTopAtStart.current < 50) {
      // Save before navigating back
      if (isModal && onClose) {
        await handleClose();
      } else {
        await handleBack();
      }
    }
  };
  
  // Tag suggestions
  const filteredSuggestions = existingTags.filter(
    tag => tag.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(tag)
  );
  
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
        className="flex-1 flex flex-col h-full overflow-y-auto relative editor-scroll-container"
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
            tabIndex={0}
            className={cn(
              "relative w-full h-48 bg-dots bg-muted/30 flex items-center justify-center overflow-hidden group transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary border-b",
              isDragging && "bg-muted/50 border-2 border-dashed border-primary",
              !imageUrl && "md:hover:bg-muted/40 md:cursor-pointer"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
                <p className="text-sm">Add cover</p>
              </div>
            )}
          </div>
          
          {/* Navigation / Actions Header */}
          <div className="absolute top-4 left-4 z-20 flex gap-2">
            {/* Back Button (Full Page) */}
            {!isModal && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90 gap-1"
                onClick={handleBack}
                disabled={isSaving}
              >
                <ChevronLeft className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Back'}
              </Button>
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
          </div>
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
            <div className="max-w-2xl mx-auto space-y-8">
            {/* Title Section */}
            <div id="section-overview" className="space-y-2">
              <textarea
                value={title}
                onChange={(e) => {
                  handleTitleChange(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                className="w-full text-3xl md:text-5xl font-bold font-sans tracking-tight bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 overflow-hidden"
                placeholder="Untitled"
                rows={1}
                style={{ height: 'auto' }}
              />
              
              {/* Tags Row */}
              <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
                {tags.map(tag => (
                  <Badge key={tag} variant="outline" className="gap-1 pr-1 bg-transparent hover:bg-secondary/30 text-sm font-normal text-muted-foreground border-transparent hover:border-border transition-all">
                    #{tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-foreground rounded-full p-0.5 ml-1 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
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
                  {showTagSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-50 min-w-[150px]">
                      {filteredSuggestions.slice(0, 5).map(tag => (
                        <button
                          key={tag}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                          onClick={() => handleAddTag(tag)}
                        >
                          #{tag}
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
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={item.toBuy}
                        onCheckedChange={() => handleUpdateMaterial(item.id, 'toBuy')}
                      />
                      <span className="text-xs text-muted-foreground w-16">To Buy</span>
                      <Checkbox
                        checked={item.toBuild}
                        onCheckedChange={() => handleUpdateMaterial(item.id, 'toBuild')}
                      />
                      <span className="text-xs text-muted-foreground w-16">To Build</span>
                      <span className={cn("flex-1", (item.toBuy || item.toBuild) && "line-through text-muted-foreground")}>
                        {item.text}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                      onClick={() => handleDeleteMaterial(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
            <div id="section-plans" className="space-y-4 pt-8 border-t">
              <h2 className="text-2xl font-bold">Plans & Sketches</h2>
              <input
                type="file"
                id="plans-upload"
                className="hidden"
                multiple
                accept="image/*,.pdf"
                onChange={handlePlansUpload}
              />
              {plans.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center gap-2 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => document.getElementById('plans-upload')?.click()}>
                  <Upload className="h-8 w-8 opacity-50" />
                  <p>Upload plans, sketches, or PDFs</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {plans.map(item => (
                    <div key={item.id} className="group relative border rounded-lg overflow-hidden bg-background hover:shadow-md transition-all cursor-pointer" onClick={() => openAttachment(item.url, item.type, item.name)}>
                      <div className="aspect-[3/2] relative bg-muted/20">
                        {item.type.startsWith('image/') ? (
                          <Image 
                            src={item.url} 
                            alt={item.name} 
                            fill 
                            className="object-contain p-2" 
                            unoptimized 
                          />
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
                  <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/10 cursor-pointer min-h-[200px]" onClick={() => document.getElementById('plans-upload')?.click()}>
                    <Plus className="h-8 w-8 opacity-50 mb-2" />
                    <span className="text-sm">Add more</span>
                  </div>
                </div>
              )}
            </div>

            {/* Inspiration Section */}
            <div id="section-inspiration" className="space-y-4 pt-8 border-t">
              <h2 className="text-2xl font-bold">Inspiration</h2>
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
                          <div className="group relative rounded-lg overflow-hidden bg-muted/20 cursor-pointer aspect-[4/3]" onClick={() => openAttachment(item.url, item.type, item.name)}>
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
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-10 w-10 p-0" 
                                onClick={() => handleSetInspirationAsCover(item.url)}
                                title="Set as cover"
                              >
                                <Images className="h-5 w-5" />
                              </Button>
                              <Button size="sm" variant="secondary" className="h-10 w-10 p-0" onClick={() => openAttachment(item.url, item.type, item.name)}>
                                <Maximize2 className="h-5 w-5" />
                              </Button>
                              <Button size="sm" variant="destructive" className="h-10 w-10 p-0" onClick={() => handleRemoveInspiration(item.id)}>
                                <Trash2 className="h-5 w-5" />
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
                        <div key={item.id} className="break-inside-avoid group relative rounded-lg overflow-hidden bg-muted/20 mb-4 cursor-pointer" onClick={() => openAttachment(item.url, item.type, item.name)}>
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
                              onClick={() => handleSetInspirationAsCover(item.url)}
                              title="Set as cover"
                            >
                              <Images className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => openAttachment(item.url, item.type, item.name)}>
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => handleRemoveInspiration(item.id)}>
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
                <Button onClick={handleClose} size="lg" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Done'}
                </Button>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Project } from './KanbanBoard';
import { createProject, updateProject, deleteProject, generateProjectImage, uploadImageBase64, uploadFile } from '@/app/actions';
import Image from 'next/image';
import { Loader2, Sparkles, Trash2, Upload, Image as ImageIcon, X, FileText, Paperclip, Maximize2, ChevronLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Attachment = { id: string; url: string; name: string; type: string; size: number };

type ProjectEditorProps = {
  project?: Project | null;
  initialStatus?: string;
  existingTags?: string[];
  onClose?: () => void; // For closing the editor (if modal)
  isModal?: boolean;
  className?: string;
};

export function ProjectEditor({ project, initialStatus, existingTags = [], onClose, isModal = false, className }: ProjectEditorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    richContent: string;
    materialsList: { id: string; text: string; toBuy: boolean; toBuild: boolean }[];
    plans: Attachment[]; // Changed to Attachment array for gallery
    inspiration: Attachment[]; // Changed to Attachment array for grid
    imageUrl: string;
    status: string;
    tags: string[];
    attachments: Attachment[];
  }>({
    title: '',
    description: '',
    richContent: '',
    materialsList: [],
    plans: [],
    inspiration: [],
    imageUrl: '',
    status: 'todo',
    tags: [],
    attachments: [],
  });
  const [activeSection, setActiveSection] = useState('overview');
  const [isDragging, setIsDragging] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [materialsInput, setMaterialsInput] = useState('');

  const addMaterial = () => {
      if (!materialsInput.trim()) return;
      const newMaterial = {
          id: Math.random().toString(36).substr(2, 9),
          text: materialsInput.trim(),
          toBuy: false,
          toBuild: false
      };
      setFormData(prev => ({
          ...prev,
          materialsList: [...prev.materialsList, newMaterial]
      }));
      setMaterialsInput('');
  };

  const updateMaterial = (id: string, field: 'toBuy' | 'toBuild') => {
      setFormData(prev => ({
          ...prev,
          materialsList: prev.materialsList.map(item => 
              item.id === id ? { ...item, [field]: !item[field] } : item
          )
      }));
  };

  const deleteMaterial = (id: string) => {
      setFormData(prev => ({
          ...prev,
          materialsList: prev.materialsList.filter(item => item.id !== id)
      }));
  };

  const handleMaterialKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          addMaterial();
      }
  };

  // Generic helper for uploading files to specific section (plans/inspiration)
  const handleSectionUpload = async (e: React.ChangeEvent<HTMLInputElement>, section: 'plans' | 'inspiration') => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsLoading(true);
      try {
          const newAttachments: Attachment[] = [];
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const formData = new FormData();
              formData.append('file', file);
              const result = await uploadFile(formData);
              newAttachments.push(result);
          }
          setFormData(prev => ({ ...prev, [section]: [...prev[section], ...newAttachments] }));
      } catch (error) {
          console.error(`Failed to upload to ${section}`, error);
      } finally {
          setIsLoading(false);
          // Reset input value
          if (e.target) e.target.value = '';
      }
  };

  const removeSectionItem = (id: string, section: 'plans' | 'inspiration') => {
      setFormData(prev => ({ 
          ...prev, 
          [section]: prev[section].filter(item => item.id !== id) 
      }));
  };

  // Gallery View Component for Plans
  const PlansGallery = ({ items }: { items: Attachment[] }) => {
      if (items.length === 0) {
          return (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center gap-2 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => document.getElementById('plans-upload')?.click()}>
                <Upload className="h-8 w-8 opacity-50" />
                <p>Upload plans, sketches, or PDFs</p>
            </div>
          );
      }
      return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map(item => (
                  <div key={item.id} className="group relative border rounded-lg overflow-hidden bg-background hover:shadow-md transition-all">
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
                          {/* Overlay Actions */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                               <Link href={item.url} target="_blank" prefetch={false}>
                                  <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                                      <Maximize2 className="h-4 w-4" />
                                  </Button>
                               </Link>
                               <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => removeSectionItem(item.id, 'plans')}>
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
      );
  };

  // Masonry Grid for Inspiration
  const InspirationGrid = ({ items }: { items: Attachment[] }) => {
       if (items.length === 0) {
          return (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center gap-2 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => document.getElementById('inspiration-upload')?.click()}>
                <Sparkles className="h-8 w-8 opacity-50" />
                <p>Add inspiration images</p>
            </div>
          );
      }

      return (
        <div className="columns-2 sm:columns-3 gap-4 space-y-4">
             {items.map(item => (
                  <div key={item.id} className="break-inside-avoid group relative rounded-lg overflow-hidden bg-muted/20 mb-4">
                      {item.type.startsWith('image/') ? (
                          <img 
                              src={item.url} 
                              alt={item.name} 
                              className="w-full h-auto object-cover" 
                          />
                      ) : (
                           <div className="aspect-square flex items-center justify-center bg-muted text-muted-foreground">
                                <FileText className="h-8 w-8" />
                           </div>
                      )}
                       {/* Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                           <Link href={item.url} target="_blank" prefetch={false}>
                              <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                                  <Maximize2 className="h-4 w-4" />
                              </Button>
                           </Link>
                           <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => removeSectionItem(item.id, 'inspiration')}>
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
      );
  };

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const imageAreaRef = useRef<HTMLDivElement>(null);

  // Auto-save functionality
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedData = useRef(formData);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize lastSavedData when project loads
  useEffect(() => {
    if (project) {
        const initialData = {
            title: project.title,
            description: project.description || '',
            richContent: project.richContent || '',
            materialsList: typeof project.materialsList === 'string' 
                ? JSON.parse(project.materialsList || '[]') 
                : (project.materialsList || []),
            plans: typeof project.plans === 'string' ? JSON.parse(project.plans || '[]') : (project.plans || []),
            inspiration: typeof project.inspiration === 'string' ? JSON.parse(project.inspiration || '[]') : (project.inspiration || []),
            imageUrl: project.imageUrl || '',
            status: project.status,
            tags: project.tags || [],
            attachments: (project.attachments as Attachment[]) || [],
        };
        lastSavedData.current = initialData;
        setFormData(initialData);
    } else {
        setFormData({
            title: '',
            description: '',
            richContent: '',
            materialsList: [],
            plans: [],
            inspiration: [],
            imageUrl: '',
            status: initialStatus || 'todo',
            tags: [],
            attachments: [],
        });
    }
  }, [project, initialStatus]);

  useEffect(() => {
    // Only auto-save if we are editing an existing project
    if (!project) return;

    const hasChanges = JSON.stringify(formData) !== JSON.stringify(lastSavedData.current);
    if (!hasChanges) return;

    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
        try {
            await updateProject(project.id, formData);
            lastSavedData.current = formData;
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Auto-save failed', error);
            setSaveStatus('error');
        }
    }, 1500); // Debounce for 1.5 seconds

    return () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
    };
  }, [formData, project]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (project) {
        await updateProject(project.id, formData);
      } else {
        await createProject(formData);
      }
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to save project', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (confirm('Are you sure you want to delete this project?')) {
      setIsLoading(true);
      try {
        await deleteProject(project.id);
        if (onClose) {
            onClose();
        } else {
            router.push('/');
        }
      } catch (error) {
        console.error('Failed to delete project', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGenerateImage = async () => {
    if (!formData.title) return;
    setIsGenerating(true);
    try {
      const url = await generateProjectImage({ 
        title: formData.title, 
        description: formData.description 
      });
      if (formData.imageUrl) {
        setGeneratedImage(url);
      } else {
        setFormData(prev => ({ ...prev, imageUrl: url }));
      }
    } catch (error) {
      console.error('Failed to generate image', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Swipe to go back logic
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 30; // Lower threshold for easier swipe

  const onTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
      };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      
      const distanceX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const distanceY = e.changedTouches[0].clientY - touchStartRef.current.y;
      
      // Check if it's a horizontal swipe (more X than Y movement) and exceeds min distance
      if (Math.abs(distanceX) > Math.abs(distanceY) * 0.8 && distanceX > minSwipeDistance) {
          // Swiped Right -> Go Back
          if (!isModal) {
              router.push('/');
          } else if (onClose) {
              onClose();
          }
      }
      
      touchStartRef.current = null;
  };

  const handleContentImageUpload = useCallback(async (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          if (!file.type.startsWith('image/')) {
              reject(new Error("Not an image"));
              return;
          }
          
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
                 // Reuse existing upload action
                 // We use 'content-image.jpg' as a generic name, the server action handles unique naming if needed or we can be more specific
                 const url = await uploadImageBase64(base64String, file.name || 'content-image.jpg', file.type || 'image/jpeg');
                 resolve(url);
            } catch (err) {
                reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    setIsLoading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        if (base64String.length > 5 * 1024 * 1024 * 1.33) { // ~5MB limit
             alert("Image is too large (max 5MB). Please use a smaller image.");
             setIsLoading(false);
             return;
        }

        try {
            const url = await uploadImageBase64(base64String, file.name || 'pasted-image.jpg', file.type || 'image/jpeg');
            setFormData(prev => ({ ...prev, imageUrl: url }));
            setGeneratedImage(null);
        } catch (error: any) {
            console.error('Failed to upload image - Details:', error);
            alert(`Upload failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);

    } catch (error) {
      console.error('Failed to setup upload', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only enable paste listener if this component is focused or active
    // A bit tricky without a specific focus target, but usually fine in modal or page
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Check if event target is an input or textarea to avoid intercepting text paste
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return; // Let default behavior happen for text inputs
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            
            const fileToUpload = file.name ? file : new File([file], "pasted-image.png", { type: file.type });
            
            handleFileUpload(fileToUpload);
            return;
          }
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handleFileUpload]);


  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsLoading(true);
      try {
          const newAttachments: Attachment[] = [];
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const formData = new FormData();
              formData.append('file', file);
              const result = await uploadFile(formData);
              newAttachments.push(result);
          }
          setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
      } catch (error) {
          console.error('Failed to upload attachment', error);
      } finally {
          setIsLoading(false);
          if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      }
  };

  const removeAttachment = (id: string) => {
      setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          addTag(tagInput);
      }
  };

  const addTag = (tag: string) => {
      const trimmedTag = tag.trim();
      if (trimmedTag && !formData.tags.includes(trimmedTag)) {
          setFormData(prev => ({ ...prev, tags: [...prev.tags, trimmedTag] }));
          setTagInput('');
          setShowTagSuggestions(false);
      }
  };

  const removeTag = (tagToRemove: string) => {
      setFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const filteredSuggestions = existingTags.filter(
      tag => tag.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags.includes(tag)
  );

  const scrollToSection = (id: string) => {
      const element = document.getElementById(id);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          setActiveSection(id);
      }
  };

    return (
    <div 
        className={cn("flex h-full bg-background touch-pan-y", className)}
    >
        {/* Sidebar (Desktop only) */}
        <div className="hidden md:flex w-48 flex-col gap-1 p-6 border-r pt-24 sticky top-0 h-full shrink-0">
            <div className="font-semibold mb-4 px-2 text-sm text-muted-foreground uppercase tracking-wider">Contents</div>
            <button onClick={() => scrollToSection('overview')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'overview' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>Project Overview</button>
            <button onClick={() => scrollToSection('materials')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'materials' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>Materials List</button>
            <button onClick={() => scrollToSection('plans')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'plans' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>Plans</button>
            <button onClick={() => scrollToSection('inspiration')} className={cn("text-left px-2 py-1.5 rounded text-sm font-medium transition-colors", activeSection === 'inspiration' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground")}>Inspiration</button>
        </div>

        {/* Main Content Wrapper */}
        <div 
            className="flex-1 flex flex-col h-full overflow-hidden relative"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
        {/* Header / Cover Image */}
        <div className="relative shrink-0 group/cover">
            <div 
            ref={imageAreaRef}
            tabIndex={0}
            className={cn(
                "relative w-full h-48 bg-dots bg-muted/30 flex items-center justify-center overflow-hidden group cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary border-b",
                isDragging && "bg-muted/50 border-2 border-dashed border-primary",
                !formData.imageUrl && "hover:bg-muted/40"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isGenerating && fileInputRef.current?.click()}
            >
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                }}
            />
            
            {isGenerating && !formData.imageUrl ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Creating your cover image...</p>
                </div>
            ) : formData.imageUrl ? (
                <>
                <Image
                    src={formData.imageUrl}
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
                        onClick={() => router.push('/')}
                    >
                        <ChevronLeft className="h-4 w-4" /> Back
                    </Button>
                )}

                {/* Expand Button (Modal) */}
                {project && isModal && (
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

             {/* Action Buttons (Bottom Right of Image) */}
            <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                 <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateImage();
                    }}
                    disabled={isLoading || isGenerating || !formData.title}
                    title="Generate AI Cover"
                >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    <span className="ml-2 hidden sm:inline">Generate Cover</span>
                </Button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 sm:p-10">
            <div className="max-w-2xl mx-auto space-y-8">
            {/* Title Section */}
            <div className="space-y-2">
                <textarea
                    value={formData.title}
                    onChange={(e) => {
                        setFormData({ ...formData, title: e.target.value });
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    className="w-full text-5xl font-bold font-sans tracking-tight bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 overflow-hidden"
                    placeholder="Untitled"
                    rows={1}
                    style={{ height: 'auto' }}
                />
                
                {/* Tags Row */}
                <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
                    {formData.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="gap-1 pr-1 bg-transparent hover:bg-secondary/30 text-sm font-normal text-muted-foreground border-transparent hover:border-border transition-all">
                            #{tag}
                            <button onClick={() => removeTag(tag)} className="hover:text-foreground rounded-full p-0.5 ml-1 transition-colors">
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
                            onKeyDown={handleAddTag}
                            placeholder="Add tag..."
                            className="h-8 w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                            autoComplete="off"
                        />
                        {showTagSuggestions && filteredSuggestions.length > 0 && (
                            <div className="absolute z-10 w-64 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                                {filteredSuggestions.map(tag => (
                                    <div
                                        key={tag}
                                        className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm"
                                        onClick={() => addTag(tag)}
                                    >
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="space-y-16 pb-20">
                 {/* Project Overview */}
                <div id="overview" className="space-y-4 scroll-mt-20" onMouseEnter={() => setActiveSection('overview')}>
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground/80">
                        Project Overview
                    </h2>
                    <div className="min-h-[100px]">
                        <RichTextEditor
                            content={formData.description}
                            onChange={(content) => setFormData({ ...formData, description: content })}
                            placeholder="Describe your project..."
                            className="text-base leading-relaxed text-foreground"
                            onImageUpload={handleContentImageUpload}
                        />
                    </div>
                </div>

                {/* Materials List */}
                <div id="materials" className="space-y-4 scroll-mt-20" onMouseEnter={() => setActiveSection('materials')}>
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground/80">
                        Materials List
                    </h2>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                value={materialsInput}
                                onChange={(e) => setMaterialsInput(e.target.value)}
                                onKeyDown={handleMaterialKeyDown}
                                placeholder="Add a material..."
                                className="flex-1"
                            />
                            <Button onClick={addMaterial} size="icon" variant="secondary">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {/* Header Row */}
                            {formData.materialsList.length > 0 && (
                                <div className="flex items-center gap-4 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <div className="flex-1">Item</div>
                                    <div className="w-16 text-center">To Buy</div>
                                    <div className="w-16 text-center">To Build</div>
                                    <div className="w-8"></div>
                                </div>
                            )}
                            
                            {/* List Items */}
                            {formData.materialsList.map(item => (
                                <div key={item.id} className="flex items-center gap-4 p-2 rounded-md hover:bg-accent/30 group transition-colors">
                                    <div className="flex-1 text-sm">{item.text}</div>
                                    <div className="w-16 flex justify-center">
                                        <Checkbox 
                                            checked={item.toBuy} 
                                            onCheckedChange={() => updateMaterial(item.id, 'toBuy')}
                                        />
                                    </div>
                                    <div className="w-16 flex justify-center">
                                        <Checkbox 
                                            checked={item.toBuild} 
                                            onCheckedChange={() => updateMaterial(item.id, 'toBuild')}
                                        />
                                    </div>
                                    <div className="w-8 flex justify-center">
                                        <button 
                                            onClick={() => deleteMaterial(item.id)}
                                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            
                            {formData.materialsList.length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                                    No materials added yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Plans */}
                <div id="plans" className="space-y-4 scroll-mt-20" onMouseEnter={() => setActiveSection('plans')}>
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground/80">
                        Plans & Sketches
                    </h2>
                    <div className="min-h-[100px]">
                        <PlansGallery items={formData.plans} />
                        <input 
                            type="file" 
                            id="plans-upload" 
                            className="hidden" 
                            multiple 
                            onChange={(e) => handleSectionUpload(e, 'plans')} 
                        />
                    </div>
                </div>

                {/* Inspiration */}
                <div id="inspiration" className="space-y-4 scroll-mt-20" onMouseEnter={() => setActiveSection('inspiration')}>
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground/80">
                        Inspiration
                    </h2>
                    <div className="min-h-[100px]">
                        <InspirationGrid items={formData.inspiration} />
                        <input 
                            type="file" 
                            id="inspiration-upload" 
                            className="hidden" 
                            multiple 
                            accept="image/*"
                            onChange={(e) => handleSectionUpload(e, 'inspiration')} 
                        />
                    </div>
                </div>
                
                {/* Attachments Grid - kept at bottom as global attachments */}
                {formData.attachments.length > 0 && (
                    <div className="space-y-4 border-t pt-8">
                         <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Global Attachments</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                             {formData.attachments.map(file => (
                                <div key={file.id} className="group relative border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors">
                                    <div className="aspect-[4/3] relative">
                                        {file.type.startsWith('image/') ? (
                                            <Image 
                                                src={file.url} 
                                                alt={file.name} 
                                                fill 
                                                className="object-cover" 
                                                unoptimized 
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <FileText className="h-10 w-10 text-muted-foreground/50" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 text-xs truncate font-medium flex justify-between items-center">
                                        <span className="truncate max-w-[80%]">{file.name}</span>
                                        <button 
                                            onClick={() => removeAttachment(file.id)}
                                            className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                 {/* Add Attachment Button */}
                 <div className="pt-2">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => attachmentInputRef.current?.click()}
                        className="text-muted-foreground hover:text-foreground pl-0 gap-2"
                    >
                        <Paperclip className="h-4 w-4" /> Add Attachment
                    </Button>
                    <input
                        type="file"
                        ref={attachmentInputRef}
                        className="hidden"
                        multiple
                        onChange={handleAttachmentUpload}
                    />
                </div>
            </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-background flex justify-between items-center">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
                {project ? "Last updated just now" : "Draft"}
                {saveStatus === 'saving' && <span className="text-primary animate-pulse">Saving...</span>}
                {saveStatus === 'saved' && <span className="text-green-500">Saved</span>}
                {saveStatus === 'error' && <span className="text-destructive">Error saving</span>}
            </div>
            <div className="flex gap-2">
                {project && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleDelete}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                {isModal && (
                    <Button type="submit" onClick={handleSubmit} disabled={isLoading || isGenerating}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Done"}
                    </Button>
                )}
            </div>
        </div>
        </div>
    </div>
  );
}


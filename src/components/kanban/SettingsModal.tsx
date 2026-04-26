'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSettings, updateSettings, getAllMediaFiles, deleteMediaFile, getAllTags, createTag, updateTag, deleteTag, getAllProjectGroups, createProjectGroup, updateProjectGroup, deleteProjectGroup, uploadFile, getImageStyles, createImageStyle, updateImageStyle, deleteImageStyle, uploadImageBase64, type ImageStyle } from '@/app/actions';
import { logout } from '@/app/login/actions';
import { Loader2, LogOut, Trash2, Image as ImageIcon, FileText, Plus, Edit2, Upload, X, Code, Wand2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DEFAULT_TAG_COLOR } from '@/lib/constants';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type MediaFile = {
  url: string;
  name: string;
  type: string;
  size: number;
  usedBy: string[]; // Project IDs that use this file
};

type Tag = {
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  icon?: string;
};

// Tag item component with local color state
function TagItem({ 
  tag, 
  onUpdate, 
  onDelete, 
  onIconUpload 
}: { 
  tag: Tag; 
  onUpdate: (name: string, updates: Partial<Tag>) => void;
  onDelete: (name: string) => void;
  onIconUpload: (name: string, file: File) => void;
}) {
  const [localColor, setLocalColor] = useState(tag.color);

  // Sync local state when tag color changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalColor(tag.color);
  }, [tag.color]);

  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      {tag.icon ? (
        <div className="relative w-8 h-8 flex-shrink-0">
          <Image
            src={tag.icon}
            alt={tag.name}
            width={32}
            height={32}
            className="rounded object-cover"
            unoptimized
          />
        </div>
      ) : (
        <span className="text-xl">{tag.emoji || '🏷️'}</span>
      )}
      <span className="flex-1 font-medium">{tag.name}</span>
      <div className="flex items-center gap-2">
        <div 
          className="w-8 h-8 rounded border flex-shrink-0"
          style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(localColor) ? localColor : tag.color }}
        />
        <Input
          type="text"
          value={localColor}
          onChange={(e) => setLocalColor(e.target.value)}
          onBlur={() => {
            if (/^#[0-9A-Fa-f]{6}$/.test(localColor) && localColor !== tag.color) {
              onUpdate(tag.name, { color: localColor });
            } else if (!/^#[0-9A-Fa-f]{6}$/.test(localColor)) {
              setLocalColor(tag.color);
            }
          }}
          placeholder="#64748b"
          className="w-24 h-8 font-mono text-xs"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) onIconUpload(tag.name, file);
          };
          input.click();
        }}
        title="Upload icon"
      >
        <Upload className="h-4 w-4" />
      </Button>
      {tag.icon && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onUpdate(tag.name, { icon: undefined })}
          title="Remove icon"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(tag.name)}
        title="Delete tag"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Project group item component with local color state
function ProjectGroupItem({ 
  group, 
  onUpdate, 
  onDelete, 
  onIconUpload 
}: { 
  group: ProjectGroup; 
  onUpdate: (id: string, updates: Partial<ProjectGroup>) => void;
  onDelete: (id: string, name: string) => void;
  onIconUpload: (id: string, file: File) => void;
}) {
  const [localColor, setLocalColor] = useState(group.color);

  // Sync local state when group color changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalColor(group.color);
  }, [group.color]);

  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      {group.icon ? (
        <div className="relative w-8 h-8 flex-shrink-0">
          <Image
            src={group.icon}
            alt={group.name}
            width={32}
            height={32}
            className="rounded object-cover"
            unoptimized
          />
        </div>
      ) : (
        <span className="text-xl">{group.emoji || '📁'}</span>
      )}
      <span className="flex-1 font-medium">{group.name}</span>
      <div className="flex items-center gap-2">
        <div 
          className="w-8 h-8 rounded border flex-shrink-0"
          style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(localColor) ? localColor : group.color }}
        />
        <Input
          type="text"
          value={localColor}
          onChange={(e) => setLocalColor(e.target.value)}
          onBlur={() => {
            if (/^#[0-9A-Fa-f]{6}$/.test(localColor) && localColor !== group.color) {
              onUpdate(group.id, { color: localColor });
            } else if (!/^#[0-9A-Fa-f]{6}$/.test(localColor)) {
              setLocalColor(group.color);
            }
          }}
          placeholder="#64748b"
          className="w-24 h-8 font-mono text-xs"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) onIconUpload(group.id, file);
          };
          input.click();
        }}
        title="Upload icon"
      >
        <Upload className="h-4 w-4" />
      </Button>
      {group.icon && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onUpdate(group.id, { icon: undefined })}
          title="Remove icon"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(group.id, group.name)}
        title="Delete project group"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const confirmDialog = useConfirm();
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [cardSize, setCardSize] = useState('medium');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [embedCopied, setEmbedCopied] = useState(false);
  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);
  const [newTagEmoji, setNewTagEmoji] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  
  // Project Groups state
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(DEFAULT_TAG_COLOR);
  const [newGroupEmoji, setNewGroupEmoji] = useState('');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  // Image Styles state
  const [imageStyles, setImageStyles] = useState<ImageStyle[]>([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  const [editingStyle, setEditingStyle] = useState<ImageStyle | null>(null);
  const [isStyleFormOpen, setIsStyleFormOpen] = useState(false);
  const [styleFormName, setStyleFormName] = useState('');
  const [styleFormPrompt, setStyleFormPrompt] = useState('');
  const [styleFormImages, setStyleFormImages] = useState<string[]>([]);
  const [styleFormUploading, setStyleFormUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getSettings().then((settings) => {
        setAiPrompt(settings.aiPromptTemplate);
        setCardSize(settings.cardSize || 'medium');
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'media') {
      loadMediaFiles();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'tags') {
      loadTags();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'projects') {
      loadProjectGroups();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'styles') {
      loadImageStyles();
    }
  }, [isOpen, activeTab]);

  const loadMediaFiles = async () => {
    setIsLoadingMedia(true);
    try {
      const files = await getAllMediaFiles();
      setMediaFiles(files);
    } catch (error) {
      console.error('Failed to load media files', error);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const handleDeleteMedia = async (url: string) => {
    const ok = await confirmDialog({
      title: 'Delete file?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteMediaFile(url);
      setMediaFiles(prev => prev.filter(file => file.url !== url));
    } catch (error) {
      console.error('Failed to delete media file', error);
      setSettingsError('Failed to delete file');
    }
  };

  // Tags handlers
  const loadTags = async () => {
    setIsLoadingTags(true);
    try {
      const allTags = await getAllTags();
      setTags(allTags.map(t => ({ ...t, emoji: t.emoji ?? undefined, icon: t.icon ?? undefined })));
    } catch (error) {
      console.error('Failed to load tags', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await createTag({
        name: newTagName.trim(),
        color: newTagColor,
        emoji: newTagEmoji || undefined,
      });
      setNewTagName('');
      setNewTagEmoji('');
      setNewTagColor(DEFAULT_TAG_COLOR);
      loadTags();
    } catch (error) {
      console.error('Failed to create tag', error);
      setSettingsError('Failed to create tag');
    }
  };

  const handleUpdateTag = async (name: string, updates: Partial<Tag>) => {
    try {
      await updateTag(name, updates);
      loadTags();
    } catch (error) {
      console.error('Failed to update tag', error);
    }
  };

  const handleDeleteTag = async (name: string) => {
    const ok = await confirmDialog({
      title: `Delete tag "${name}"?`,
      description: 'This will remove it from all projects.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTag(name);
      loadTags();
    } catch (error) {
      console.error('Failed to delete tag', error);
    }
  };

  // Project Groups handlers
  const loadProjectGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const groups = await getAllProjectGroups();
      setProjectGroups(groups);
    } catch (error) {
      console.error('Failed to load project groups', error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleCreateProjectGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createProjectGroup({
        name: newGroupName.trim(),
        color: newGroupColor,
        emoji: newGroupEmoji || undefined,
      });
      setNewGroupName('');
      setNewGroupEmoji('');
      setNewGroupColor(DEFAULT_TAG_COLOR);
      loadProjectGroups();
    } catch (error) {
      console.error('Failed to create project group', error);
      setSettingsError('Failed to create project group');
    }
  };

  const handleUpdateProjectGroup = async (id: string, updates: Partial<ProjectGroup>) => {
    try {
      await updateProjectGroup(id, updates);
      loadProjectGroups();
    } catch (error) {
      console.error('Failed to update project group', error);
    }
  };

  const handleDeleteProjectGroup = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete project group "${name}"?`,
      description: "Cards in this group won't be deleted.",
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteProjectGroup(id);
      loadProjectGroups();
    } catch (error) {
      console.error('Failed to delete project group', error);
    }
  };

  // Image Styles handlers
  const loadImageStyles = async () => {
    setIsLoadingStyles(true);
    try {
      const styles = await getImageStyles();
      setImageStyles(styles);
    } catch (error) {
      console.error('Failed to load image styles', error);
    } finally {
      setIsLoadingStyles(false);
    }
  };

  const openNewStyleForm = () => {
    setEditingStyle(null);
    setStyleFormName('');
    setStyleFormPrompt('');
    setStyleFormImages([]);
    setIsStyleFormOpen(true);
  };

  const openEditStyleForm = (style: ImageStyle) => {
    setEditingStyle(style);
    setStyleFormName(style.name);
    setStyleFormPrompt(style.promptOverride);
    setStyleFormImages(style.referenceImages);
    setIsStyleFormOpen(true);
  };

  const handleStyleReferenceUpload = async (file: File) => {
    setStyleFormUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const url = await uploadImageBase64(dataUrl, file.name, file.type);
      setStyleFormImages((prev) => [...prev, url]);
    } catch (error) {
      console.error('Failed to upload reference image', error);
      setSettingsError('Failed to upload image');
    } finally {
      setStyleFormUploading(false);
    }
  };

  const handleSaveStyle = async () => {
    if (!styleFormName.trim()) return;
    try {
      if (editingStyle) {
        await updateImageStyle(editingStyle.id, {
          name: styleFormName.trim(),
          promptOverride: styleFormPrompt,
          referenceImages: styleFormImages,
        });
      } else {
        await createImageStyle({
          name: styleFormName.trim(),
          promptOverride: styleFormPrompt,
          referenceImages: styleFormImages,
        });
      }
      setIsStyleFormOpen(false);
      loadImageStyles();
    } catch (error) {
      console.error('Failed to save image style', error);
      setSettingsError('Failed to save style');
    }
  };

  const handleDeleteStyle = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete style "${name}"?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteImageStyle(id);
      loadImageStyles();
    } catch (error) {
      console.error('Failed to delete image style', error);
    }
  };

  // Icon upload handlers
  const handleTagIconUpload = async (tagName: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadFile(formData);
      await updateTag(tagName, { icon: result.url });
      loadTags();
    } catch (error) {
      console.error('Failed to upload tag icon', error);
      setSettingsError('Failed to upload icon');
    }
  };

  const handleProjectGroupIconUpload = async (groupId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadFile(formData);
      await updateProjectGroup(groupId, { icon: result.url });
      loadProjectGroups();
    } catch (error) {
      console.error('Failed to upload project group icon', error);
      setSettingsError('Failed to upload icon');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateSettings({ 
        aiPromptTemplate: aiPrompt,
        cardSize: cardSize
      });
      onClose();
    } catch (error) {
      console.error('Failed to save settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {settingsError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between gap-2"
          >
            <span>{settingsError}</span>
            <button
              onClick={() => setSettingsError(null)}
              aria-label="Dismiss error"
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="styles">AI Styles</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cardSize">Card Size</Label>
                <Select value={cardSize} onValueChange={setCardSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select card size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="aiPrompt">AI Image Prompt Template</Label>
                <Input
                  id="aiPrompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Enter a prompt template..."
                />
                <p className="text-xs text-muted-foreground">
                  Use <code>{'{title}'}</code> and <code>{'{description}'}</code> as placeholders.
                </p>
              </div>
              
              <DialogFooter className="flex justify-between sm:justify-between gap-2">
                <Button type="button" variant="destructive" onClick={() => logout()} className="mr-auto">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="tags" className="flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <Label>Create New Tag</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  />
                  <Input
                    type="text"
                    placeholder="🏷️"
                    value={newTagEmoji}
                    onChange={(e) => setNewTagEmoji(e.target.value)}
                    className="w-20"
                    maxLength={2}
                  />
                  <Input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-20"
                  />
                  <Button onClick={handleCreateTag} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isLoadingTags ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tags yet. Create one above!
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <TagItem
                      key={tag.name}
                      tag={tag}
                      onUpdate={handleUpdateTag}
                      onDelete={handleDeleteTag}
                      onIconUpload={handleTagIconUpload}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <Label>Create New Project Group</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Project group name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProjectGroup()}
                  />
                  <Input
                    type="text"
                    placeholder="📁"
                    value={newGroupEmoji}
                    onChange={(e) => setNewGroupEmoji(e.target.value)}
                    className="w-20"
                    maxLength={2}
                  />
                  <Input
                    type="color"
                    value={newGroupColor}
                    onChange={(e) => setNewGroupColor(e.target.value)}
                    className="w-20"
                  />
                  <Button onClick={handleCreateProjectGroup} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isLoadingGroups ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : projectGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No project groups yet. Create one above!
                </div>
              ) : (
                <div className="space-y-2">
                  {projectGroups.map((group) => (
                    <ProjectGroupItem
                      key={group.id}
                      group={group}
                      onUpdate={handleUpdateProjectGroup}
                      onDelete={handleDeleteProjectGroup}
                      onIconUpload={handleProjectGroupIconUpload}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="media" className="flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Manage uploaded files and clean up orphaned media
                </p>
                <Button size="sm" variant="outline" onClick={loadMediaFiles} disabled={isLoadingMedia}>
                  {isLoadingMedia && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Refresh
                </Button>
              </div>
              
              {isLoadingMedia ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : mediaFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No media files found
                </div>
              ) : (
                <div className="space-y-3">
                  {mediaFiles.map((file) => (
                    <div key={file.url} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0 w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
                        {file.type.startsWith('image/') ? (
                          <Image 
                            src={file.url} 
                            alt={file.name} 
                            width={64} 
                            height={64} 
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB • {file.usedBy.length === 0 ? 'Unused' : `Used in ${file.usedBy.length} project${file.usedBy.length > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={file.usedBy.length === 0 ? "destructive" : "ghost"}
                        onClick={() => handleDeleteMedia(file.url)}
                        title={file.usedBy.length > 0 ? "Delete (will remove from projects)" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="styles" className="flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">AI Image Styles</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create named styles with prompts and reference images to guide AI cover generation.
                  </p>
                </div>
                {!isStyleFormOpen && (
                  <Button size="sm" onClick={openNewStyleForm}>
                    <Plus className="h-4 w-4 mr-1" /> New Style
                  </Button>
                )}
              </div>

              {isStyleFormOpen && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">{editingStyle ? 'Edit Style' : 'New Style'}</p>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      className="w-full px-3 py-1.5 text-sm border rounded-md bg-background"
                      placeholder="e.g. Sketchy, Watercolour, Minimal…"
                      value={styleFormName}
                      onChange={(e) => setStyleFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Style prompt <span className="font-normal opacity-70">— describe the look, medium, colour palette…</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background resize-none"
                      rows={3}
                      placeholder="Loose pencil sketch, cross-hatching, monochrome with subtle sepia tones…"
                      value={styleFormPrompt}
                      onChange={(e) => setStyleFormPrompt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Reference images (up to 10)</label>
                    <div className="flex flex-wrap gap-2">
                      {styleFormImages.map((url, i) => (
                        <div key={url} className="relative w-16 h-16 rounded overflow-hidden border group">
                          <Image src={url} alt={`ref ${i + 1}`} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                          <button
                            onClick={() => setStyleFormImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ))}
                      {styleFormImages.length < 10 && (
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.multiple = true;
                            input.onchange = async (e) => {
                              const files = Array.from((e.target as HTMLInputElement).files ?? []);
                              for (const file of files) {
                                await handleStyleReferenceUpload(file);
                              }
                            };
                            input.click();
                          }}
                          disabled={styleFormUploading}
                          className="w-16 h-16 border-2 border-dashed rounded flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                        >
                          {styleFormUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              <span className="text-[10px] mt-0.5">Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setIsStyleFormOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveStyle} disabled={!styleFormName.trim()}>
                      {editingStyle ? 'Save Changes' : 'Create Style'}
                    </Button>
                  </div>
                </div>
              )}

              {isLoadingStyles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : imageStyles.length === 0 && !isStyleFormOpen ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No styles yet.</p>
                  <p className="text-xs mt-1">Create a style to guide AI cover image generation.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {imageStyles.map((style) => (
                    <div key={style.id} className="border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                      <div className="h-24 bg-muted/40 relative overflow-hidden">
                        {style.referenceImages.length > 0 ? (
                          <Image
                            src={style.referenceImages[0]}
                            alt={style.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Wand2 className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                        {style.referenceImages.length > 1 && (
                          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                            +{style.referenceImages.length - 1}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-sm font-medium truncate">{style.name}</p>
                        {style.promptOverride && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{style.promptOverride}</p>
                        )}
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs flex-1" onClick={() => openEditStyleForm(style)}>
                            <Edit2 className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteStyle(style.id, style.name)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="embed" className="flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Embed Your Board</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Share your kanban board on external sites using an iframe. The embedded view shows a clean, read-only version of your board.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Embed URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/embed`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/embed`);
                        setEmbedCopied(true);
                        setTimeout(() => setEmbedCopied(false), 2000);
                      }
                    }}
                  >
                    {embedCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Embed Code</Label>
                <div className="relative">
                  <textarea
                    readOnly
                    value={`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/embed" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`}
                    className="w-full h-24 p-3 font-mono text-xs border rounded-md bg-muted/50 resize-none"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const embedCode = `<iframe src="${window.location.origin}/embed" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;
                        navigator.clipboard.writeText(embedCode);
                        setEmbedCopied(true);
                        setTimeout(() => setEmbedCopied(false), 2000);
                      }
                    }}
                  >
                    <Code className="h-4 w-4 mr-2" />
                    {embedCopied ? 'Copied!' : 'Copy Code'}
                  </Button>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-2">Preview</h4>
                <a
                  href="/embed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open embed view in new tab →
                </a>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

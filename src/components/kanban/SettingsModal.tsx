'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSettings, updateSettings, getAllMediaFiles, deleteMediaFile, getAllTags, createTag, updateTag, renameTag, deleteTag, getAllProjectGroups, createProjectGroup, updateProjectGroup, deleteProjectGroup, uploadFile, getImageStyles, createImageStyle, updateImageStyle, deleteImageStyle, uploadImageBase64, type ImageStyle } from '@/app/actions';
import { logout } from '@/app/login/actions';
import { Loader2, LogOut, Trash2, Image as ImageIcon, FileText, Plus, Edit2, Upload, X, Code, Wand2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DEFAULT_TAG_COLOR } from '@/lib/constants';
import styles from './SettingsModal.module.css';

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
  tags: string[];
  matchMode: 'any' | 'all';
};

// Tag item component with local color state
function TagItem({ 
  tag,
  onUpdate,
  onRename,
  onDelete,
  onIconUpload 
}: { 
  tag: Tag; 
  onUpdate: (name: string, updates: Partial<Tag>) => void;
  onRename: (name: string, newName: string) => void;
  onDelete: (name: string) => void;
  onIconUpload: (name: string, file: File) => void;
}) {
  const [localColor, setLocalColor] = useState(tag.color);
  const [localName, setLocalName] = useState(tag.name);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalName(tag.name);
  }, [tag.name]);

  const commitName = () => {
    const next = localName.trim();
    if (next && next !== tag.name) onRename(tag.name, next);
    else setLocalName(tag.name);
  };

  // Sync local state when tag color changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalColor(tag.color);
  }, [tag.color]);

  return (
    <div className={styles.ItemRow}>
      {tag.icon ? (
        <div className={styles.IconWrap}>
          <Image
            src={tag.icon}
            alt={tag.name}
            width={32}
            height={32}
            className={styles.IconImage}
            unoptimized
          />
        </div>
      ) : (
        <span className={styles.Emoji}>{tag.emoji || '🏷️'}</span>
      )}
      <Input
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setLocalName(tag.name); e.currentTarget.blur(); }
        }}
        aria-label={`Rename tag ${tag.name}`}
        className={styles.TagNameInput}
      />
      <div className={styles.InlineRow}>
        <div 
          className={styles.Swatch}
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
          className={styles.ColorInput}
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
        <Upload className={styles.Icon} />
      </Button>
      {tag.icon && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onUpdate(tag.name, { icon: undefined })}
          title="Remove icon"
        >
          <X className={styles.Icon} />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(tag.name)}
        title="Delete tag"
      >
        <Trash2 className={styles.Icon} />
      </Button>
    </div>
  );
}

// Project group item: a named collection of tags. The top row is the same
// name/colour/icon strip as a tag; the bottom row picks which tags make up
// the project and whether a card needs any or all of them.
function ProjectGroupItem({ 
  group, 
  allTags,
  onUpdate, 
  onDelete, 
  onIconUpload 
}: { 
  group: ProjectGroup; 
  allTags: Tag[];
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

  const toggleTag = (name: string) => {
    const next = group.tags.includes(name)
      ? group.tags.filter((t) => t !== name)
      : [...group.tags, name];
    onUpdate(group.id, { tags: next });
  };

  return (
    <div className={styles.GroupItem}>
    <div className={styles.InlineRow}>
      {group.icon ? (
        <div className={styles.IconWrap}>
          <Image
            src={group.icon}
            alt={group.name}
            width={32}
            height={32}
            className={styles.IconImage}
            unoptimized
          />
        </div>
      ) : (
        <span className={styles.Emoji}>{group.emoji || '📁'}</span>
      )}
      <span className={styles.GroupName}>{group.name}</span>
      <div className={styles.InlineRow}>
        <div 
          className={styles.Swatch}
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
          className={styles.ColorInput}
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
        <Upload className={styles.Icon} />
      </Button>
      {group.icon && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onUpdate(group.id, { icon: undefined })}
          title="Remove icon"
        >
          <X className={styles.Icon} />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(group.id, group.name)}
        title="Delete project group"
      >
        <Trash2 className={styles.Icon} />
      </Button>
    </div>
    <div className={styles.MatchRow}>
      <span className={styles.MatchLabel}>Cards with</span>
      <div className={styles.ModeToggle}>
        {(['any', 'all'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => mode !== group.matchMode && onUpdate(group.id, { matchMode: mode })}
            className={cn(
              styles.ModeOption,
              group.matchMode === mode ? styles.ModeOptionActive : styles.ModeOptionIdle
            )}
          >
            {mode}
          </button>
        ))}
      </div>
      <span className={styles.MatchLabel}>of:</span>
      {allTags.length === 0 ? (
        <span className={styles.Hint}>No tags yet</span>
      ) : (
        allTags.map((tag) => {
          const on = group.tags.includes(tag.name);
          return (
            <Badge
              key={tag.name}
              variant={on ? 'default' : 'outline'}
              className={styles.TagBadge}
              style={on ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color }}
              onClick={() => toggleTag(tag.name)}
            >
              {tag.emoji && <span className={styles.BadgeEmoji}>{tag.emoji}</span>}
              {tag.name}
            </Badge>
          );
        })
      )}
      {group.tags.length === 0 && allTags.length > 0 && (
        <span className={styles.MatchWarning}>— pick at least one tag or nothing will match</span>
      )}
    </div>
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
      loadTags();
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

  const handleRenameTag = async (name: string, newName: string) => {
    try {
      await renameTag(name, newName);
      loadTags();
    } catch (error) {
      console.error('Failed to rename tag', error);
      setSettingsError(error instanceof Error ? error.message : 'Failed to rename tag');
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
      description: "Cards keep their tags; only the project is removed.",
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
      <DialogContent className={styles.Content}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {settingsError && (
          <div
            role="alert"
            className={styles.ErrorBanner}
          >
            <span>{settingsError}</span>
            <button
              onClick={() => setSettingsError(null)}
              aria-label="Dismiss error"
              className={styles.ErrorDismiss}
            >
              <X className={styles.IconSm} />
            </button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.Tabs}>
          <TabsList className={styles.TabsList}>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="styles">AI Styles</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className={styles.Panel}>
            <form onSubmit={handleSubmit} className={styles.Section}>
              <div className={styles.Stack2}>
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
              
              <div className={styles.Stack2}>
                <Label htmlFor="aiPrompt">AI Image Prompt Template</Label>
                <Input
                  id="aiPrompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Enter a prompt template..."
                />
                <p className={styles.Hint}>
                  Use <code>{'{title}'}</code> and <code>{'{description}'}</code> as placeholders.
                </p>
              </div>
              
              <DialogFooter className={styles.Footer}>
                <Button type="button" variant="destructive" onClick={() => logout()} className={styles.LogoutButton}>
                  <LogOut className={styles.IconLeading} /> Log out
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className={styles.SpinnerLeading} />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="tags" className={styles.Panel}>
            <div className={styles.Section}>
              <div className={styles.Stack3}>
                <Label>Create New Tag</Label>
                <div className={styles.FieldRow}>
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
                    className={styles.ShortInput}
                    maxLength={2}
                  />
                  <Input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className={styles.ShortInput}
                  />
                  <Button onClick={handleCreateTag} size="sm">
                    <Plus className={styles.Icon} />
                  </Button>
                </div>
              </div>

              {isLoadingTags ? (
                <div className={styles.Loading}>
                  <Loader2 className={styles.LoadingSpinner} />
                </div>
              ) : tags.length === 0 ? (
                <div className={styles.Empty}>
                  No tags yet. Create one above!
                </div>
              ) : (
                <div className={styles.Stack2}>
                  {tags.map((tag) => (
                    <TagItem
                      key={tag.name}
                      tag={tag}
                      onUpdate={handleUpdateTag}
                      onRename={handleRenameTag}
                      onDelete={handleDeleteTag}
                      onIconUpload={handleTagIconUpload}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="projects" className={styles.Panel}>
            <div className={styles.Section}>
              <div className={styles.Stack3}>
                <Label>Create New Project Group</Label>
                <div className={styles.FieldRow}>
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
                    className={styles.ShortInput}
                    maxLength={2}
                  />
                  <Input
                    type="color"
                    value={newGroupColor}
                    onChange={(e) => setNewGroupColor(e.target.value)}
                    className={styles.ShortInput}
                  />
                  <Button onClick={handleCreateProjectGroup} size="sm">
                    <Plus className={styles.Icon} />
                  </Button>
                </div>
              </div>

              {isLoadingGroups ? (
                <div className={styles.Loading}>
                  <Loader2 className={styles.LoadingSpinner} />
                </div>
              ) : projectGroups.length === 0 ? (
                <div className={styles.Empty}>
                  No project groups yet. Create one above!
                </div>
              ) : (
                <div className={styles.Stack2}>
                  {projectGroups.map((group) => (
                    <ProjectGroupItem
                      key={group.id}
                      group={group}
                      allTags={tags}
                      onUpdate={handleUpdateProjectGroup}
                      onDelete={handleDeleteProjectGroup}
                      onIconUpload={handleProjectGroupIconUpload}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="media" className={styles.Panel}>
            <div className={styles.Section}>
              <div className={styles.HeaderRow}>
                <p className={styles.Description}>
                  Manage uploaded files and clean up orphaned media
                </p>
                <Button size="sm" variant="outline" onClick={loadMediaFiles} disabled={isLoadingMedia}>
                  {isLoadingMedia && <Loader2 className={styles.SpinnerLeading} />}
                  Refresh
                </Button>
              </div>
              
              {isLoadingMedia ? (
                <div className={styles.Loading}>
                  <Loader2 className={styles.LoadingSpinner} />
                </div>
              ) : mediaFiles.length === 0 ? (
                <div className={styles.Empty}>
                  No media files found
                </div>
              ) : (
                <div className={styles.Stack3}>
                  {mediaFiles.map((file) => (
                    <div key={file.url} className={styles.MediaRow}>
                      <div className={styles.MediaThumb}>
                        {file.type.startsWith('image/') ? (
                          <Image 
                            src={file.url} 
                            alt={file.name} 
                            width={64} 
                            height={64} 
                            className={styles.CoverImage}
                            unoptimized
                          />
                        ) : (
                          <FileText className={styles.FileIcon} />
                        )}
                      </div>
                      <div className={styles.MediaInfo}>
                        <p className={styles.TruncatedTitle}>{file.name}</p>
                        <p className={styles.Hint}>
                          {(file.size / 1024).toFixed(1)} KB • {file.usedBy.length === 0 ? 'Unused' : `Used in ${file.usedBy.length} project${file.usedBy.length > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={file.usedBy.length === 0 ? "destructive" : "ghost"}
                        onClick={() => handleDeleteMedia(file.url)}
                        title={file.usedBy.length > 0 ? "Delete (will remove from projects)" : "Delete"}
                      >
                        <Trash2 className={styles.Icon} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="styles" className={styles.Panel}>
            <div className={styles.Section}>
              <div className={styles.HeaderRow}>
                <div>
                  <p className={styles.SectionTitle}>AI Image Styles</p>
                  <p className={styles.SubHint}>
                    Create named styles with prompts and reference images to guide AI cover generation.
                  </p>
                </div>
                {!isStyleFormOpen && (
                  <Button size="sm" onClick={openNewStyleForm}>
                    <Plus className={styles.IconLeadingTight} /> New Style
                  </Button>
                )}
              </div>

              {isStyleFormOpen && (
                <div className={styles.StyleForm}>
                  <p className={styles.SectionTitle}>{editingStyle ? 'Edit Style' : 'New Style'}</p>
                  <div className={styles.Stack2}>
                    <label className={styles.FieldLabel}>Name</label>
                    <input
                      className={styles.TextField}
                      placeholder="e.g. Sketchy, Watercolour, Minimal…"
                      value={styleFormName}
                      onChange={(e) => setStyleFormName(e.target.value)}
                    />
                  </div>
                  <div className={styles.Stack2}>
                    <label className={styles.FieldLabel}>
                      Style prompt <span className={styles.FieldLabelNote}>— describe the look, medium, colour palette…</span>
                    </label>
                    <textarea
                      className={styles.TextArea}
                      rows={3}
                      placeholder="Loose pencil sketch, cross-hatching, monochrome with subtle sepia tones…"
                      value={styleFormPrompt}
                      onChange={(e) => setStyleFormPrompt(e.target.value)}
                    />
                  </div>
                  <div className={styles.Stack2}>
                    <label className={styles.FieldLabel}>Reference images (up to 10)</label>
                    <div className={styles.RefGrid}>
                      {styleFormImages.map((url, i) => (
                        <div key={url} className={styles.RefThumb}>
                          <Image src={url} alt={`ref ${i + 1}`} width={64} height={64} className={styles.CoverImage} unoptimized />
                          <button
                            onClick={() => setStyleFormImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className={styles.RefRemove}
                          >
                            <X className={styles.IconWhite} />
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
                          className={styles.RefAdd}
                        >
                          {styleFormUploading ? (
                            <Loader2 className={styles.Spinner} />
                          ) : (
                            <>
                              <Upload className={styles.Icon} />
                              <span className={styles.RefAddLabel}>Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.FormActions}>
                    <Button variant="outline" size="sm" onClick={() => setIsStyleFormOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveStyle} disabled={!styleFormName.trim()}>
                      {editingStyle ? 'Save Changes' : 'Create Style'}
                    </Button>
                  </div>
                </div>
              )}

              {isLoadingStyles ? (
                <div className={styles.Loading}>
                  <Loader2 className={styles.LoadingSpinner} />
                </div>
              ) : imageStyles.length === 0 && !isStyleFormOpen ? (
                <div className={styles.EmptyTall}>
                  <Sparkles className={styles.EmptyIcon} />
                  <p className={styles.EmptyText}>No styles yet.</p>
                  <p className={styles.EmptySubtext}>Create a style to guide AI cover image generation.</p>
                </div>
              ) : (
                <div className={styles.StyleGrid}>
                  {imageStyles.map((style) => (
                    <div key={style.id} className={styles.StyleCard}>
                      <div className={styles.StylePreview}>
                        {style.referenceImages.length > 0 ? (
                          <Image
                            src={style.referenceImages[0]}
                            alt={style.name}
                            fill
                            className={styles.PreviewImage}
                            unoptimized
                          />
                        ) : (
                          <div className={styles.PreviewPlaceholder}>
                            <Wand2 className={styles.PlaceholderIcon} />
                          </div>
                        )}
                        {style.referenceImages.length > 1 && (
                          <span className={styles.MoreCount}>
                            +{style.referenceImages.length - 1}
                          </span>
                        )}
                      </div>
                      <div className={styles.StyleBody}>
                        <p className={styles.TruncatedTitle}>{style.name}</p>
                        {style.promptOverride && (
                          <p className={styles.StylePrompt}>{style.promptOverride}</p>
                        )}
                        <div className={styles.StyleActions}>
                          <Button size="sm" variant="ghost" className={styles.StyleActionEdit} onClick={() => openEditStyleForm(style)}>
                            <Edit2 className={styles.IconSmLeading} /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className={styles.StyleActionDelete} onClick={() => handleDeleteStyle(style.id, style.name)}>
                            <Trash2 className={styles.IconSm} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="embed" className={styles.Panel}>
            <div className={styles.Section}>
              <div>
                <h3 className={styles.EmbedTitle}>Embed Your Board</h3>
                <p className={styles.EmbedIntro}>
                  Share your kanban board on external sites using an iframe. The embedded view shows a clean, read-only version of your board.
                </p>
              </div>
              
              <div className={styles.Stack2}>
                <Label>Embed URL</Label>
                <div className={styles.FieldRow}>
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/kanban/embed`}
                    className={styles.MonoInput}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/kanban/embed`);
                        setEmbedCopied(true);
                        setTimeout(() => setEmbedCopied(false), 2000);
                      }
                    }}
                  >
                    {embedCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              
              <div className={styles.Stack2}>
                <Label>Embed Code</Label>
                <div className={styles.CodeWrap}>
                  <textarea
                    readOnly
                    value={`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/kanban/embed" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`}
                    className={styles.CodeArea}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className={styles.CopyCodeButton}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const embedCode = `<iframe src="${window.location.origin}/kanban/embed" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;
                        navigator.clipboard.writeText(embedCode);
                        setEmbedCopied(true);
                        setTimeout(() => setEmbedCopied(false), 2000);
                      }
                    }}
                  >
                    <Code className={styles.IconLeading} />
                    {embedCopied ? 'Copied!' : 'Copy Code'}
                  </Button>
                </div>
              </div>
              
              <div className={styles.PreviewSection}>
                <h4 className={styles.PreviewHeading}>Preview</h4>
                {/* Plain <a> and copied URLs don't get Next's basePath — the
                    /kanban prefix is spelled out, as in layout.tsx. */}
                <a
                  href="/kanban/embed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.PreviewLink}
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

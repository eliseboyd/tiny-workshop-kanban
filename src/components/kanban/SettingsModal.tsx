'use client';

import { useState, useEffect } from 'react';
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
import { getSettings, updateSettings, getAllMediaFiles, deleteMediaFile, getAllTags, createTag, updateTag, deleteTag, getAllProjectGroups, createProjectGroup, updateProjectGroup, deleteProjectGroup, uploadFile } from '@/app/actions';
import { logout } from '@/app/login/actions';
import { Loader2, LogOut, Trash2, Image as ImageIcon, FileText, Plus, Edit2, Upload, X } from 'lucide-react';
import Image from 'next/image';

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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [cardSize, setCardSize] = useState('medium');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#64748b');
  const [newTagEmoji, setNewTagEmoji] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  
  // Project Groups state
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#64748b');
  const [newGroupEmoji, setNewGroupEmoji] = useState('');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

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
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteMediaFile(url);
      setMediaFiles(prev => prev.filter(file => file.url !== url));
    } catch (error) {
      console.error('Failed to delete media file', error);
      alert('Failed to delete file');
    }
  };

  // Tags handlers
  const loadTags = async () => {
    setIsLoadingTags(true);
    try {
      const allTags = await getAllTags();
      setTags(allTags);
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
      setNewTagColor('#64748b');
      loadTags();
    } catch (error) {
      console.error('Failed to create tag', error);
      alert('Failed to create tag');
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
    if (!confirm(`Delete tag "${name}"? This will remove it from all projects.`)) return;
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
      setNewGroupColor('#64748b');
      loadProjectGroups();
    } catch (error) {
      console.error('Failed to create project group', error);
      alert('Failed to create project group');
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
    if (!confirm(`Delete project group "${name}"? Cards in this group won't be deleted.`)) return;
    try {
      await deleteProjectGroup(id);
      loadProjectGroups();
    } catch (error) {
      console.error('Failed to delete project group', error);
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
      alert('Failed to upload icon');
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
      alert('Failed to upload icon');
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
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
                    <div key={tag.name} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      {/* Icon or Emoji Display */}
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
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 font-medium">{tag.name}</span>
                      <Input
                        type="color"
                        value={tag.color}
                        onChange={(e) => handleUpdateTag(tag.name, { color: e.target.value })}
                        className="w-16 h-8"
                      />
                      {/* Icon Upload */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleTagIconUpload(tag.name, file);
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
                          onClick={() => handleUpdateTag(tag.name, { icon: undefined })}
                          title="Remove icon"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTag(tag.name)}
                        title="Delete tag"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
                    <div key={group.id} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      {/* Icon or Emoji Display */}
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
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="flex-1 font-medium">{group.name}</span>
                      <Input
                        type="color"
                        value={group.color}
                        onChange={(e) => handleUpdateProjectGroup(group.id, { color: e.target.value })}
                        className="w-16 h-8"
                      />
                      {/* Icon Upload */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleProjectGroupIconUpload(group.id, file);
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
                          onClick={() => handleUpdateProjectGroup(group.id, { icon: undefined })}
                          title="Remove icon"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteProjectGroup(group.id, group.name)}
                        title="Delete project group"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

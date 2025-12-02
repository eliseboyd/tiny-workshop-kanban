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
import { getSettings, updateSettings, getAllMediaFiles, deleteMediaFile } from '@/app/actions';
import { logout } from '@/app/login/actions';
import { Loader2, LogOut, Trash2, Image as ImageIcon, FileText } from 'lucide-react';
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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [cardSize, setCardSize] = useState('medium');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="media">Media Gallery</TabsTrigger>
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

'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Column } from './KanbanBoard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Sparkles } from 'lucide-react';

type QuickAddDialogProps = {
  columns: Column[];
  onCreated?: () => void;
};

type LinkMetadata = {
  title?: string;
  description?: string;
  suggestedTags?: string[];
  contentType?: string;
  image?: string | null;
};

export function QuickAddDialog({ columns, onCreated }: QuickAddDialogProps) {
  const router = useRouter();
  const defaultColumnId = columns[0]?.id;

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'note' | 'task'>('link');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link tab state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkTags, setLinkTags] = useState('');
  const [linkDestination, setLinkDestination] = useState<'ideas' | 'kanban'>('ideas');
  const [linkColumnId, setLinkColumnId] = useState(defaultColumnId);
  const [linkMetadata, setLinkMetadata] = useState<LinkMetadata>({});

  // Note tab state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDescription, setNoteDescription] = useState('');
  const [noteTags, setNoteTags] = useState('');

  // Task tab state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskColumnId, setTaskColumnId] = useState(defaultColumnId);

  const parsedLinkTags = useMemo(() => {
    return linkTags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
  }, [linkTags]);

  const parsedNoteTags = useMemo(() => {
    return noteTags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
  }, [noteTags]);

  const resetForm = () => {
    setLinkUrl('');
    setLinkTitle('');
    setLinkDescription('');
    setLinkTags('');
    setLinkDestination('ideas');
    setLinkColumnId(defaultColumnId);
    setLinkMetadata({});
    setNoteTitle('');
    setNoteDescription('');
    setNoteTags('');
    setTaskTitle('');
    setTaskColumnId(defaultColumnId);
  };

  const handleProcessLink = async () => {
    if (!linkUrl.trim()) return;
    setIsProcessing(true);

    try {
      const { processLinkWithAI } = await import('@/app/actions');
      const metadata = await processLinkWithAI(linkUrl.trim());
      setLinkMetadata(metadata || {});
      if (metadata?.title) setLinkTitle(metadata.title);
      if (metadata?.description) setLinkDescription(metadata.description);
      if (metadata?.suggestedTags?.length) {
        setLinkTags(metadata.suggestedTags.join(', '));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (activeTab === 'link') {
        if (!linkUrl.trim() && !linkTitle.trim()) return;
        if (linkDestination === 'ideas') {
          const { createIdea } = await import('@/app/actions');
          await createIdea({
            title: linkTitle.trim() || 'Untitled Idea',
            description: linkDescription.trim() || undefined,
            url: linkUrl.trim() || undefined,
            tags: parsedLinkTags,
          });
        } else if (linkColumnId) {
          const { createProject } = await import('@/app/actions');
          await createProject({
            title: linkTitle.trim() || 'Untitled Project',
            description: linkDescription.trim() || undefined,
            richContent: linkUrl.trim()
              ? `<p><a href="${linkUrl.trim()}">${linkUrl.trim()}</a></p>`
              : undefined,
            status: linkColumnId,
            position: 0,
            is_task: false,
          });
        }
      }

      if (activeTab === 'note') {
        if (!noteTitle.trim() && !noteDescription.trim()) return;
        const { createIdea } = await import('@/app/actions');
        await createIdea({
          title: noteTitle.trim() || 'Untitled Idea',
          description: noteDescription.trim() || undefined,
          tags: parsedNoteTags,
        });
      }

      if (activeTab === 'task') {
        if (!taskTitle.trim() || !taskColumnId) return;
        const { createProject } = await import('@/app/actions');
        await createProject({
          title: taskTitle.trim(),
          status: taskColumnId,
          position: 0,
          is_task: true,
        });
      }

      resetForm();
      setOpen(false);
      onCreated?.();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
          size="icon"
          aria-label="Quick add"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Add
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="note">Note</TabsTrigger>
            <TabsTrigger value="task">Task</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="link-url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <Button variant="outline" onClick={handleProcessLink} disabled={isProcessing || !linkUrl.trim()}>
                  {isProcessing ? 'Processing...' : 'Process with AI'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="link-title">Title</Label>
                <Input
                  id="link-title"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Idea title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-tags">Tags (comma-separated)</Label>
                <Input
                  id="link-tags"
                  value={linkTags}
                  onChange={(e) => setLinkTags(e.target.value)}
                  placeholder="fabric, diy, kitchen"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="link-description">Description</Label>
              <Textarea
                id="link-description"
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value)}
                placeholder="Add a quick note..."
                rows={4}
              />
            </div>

            {linkMetadata?.image && (
              <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                <Image src={linkMetadata.image} alt="Link preview" fill className="object-cover" />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Destination</Label>
                <Select
                  value={linkDestination}
                  onValueChange={(value) => setLinkDestination(value as 'ideas' | 'kanban')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ideas">Ideas</SelectItem>
                    <SelectItem value="kanban">Kanban</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {linkDestination === 'kanban' && (
                <div className="space-y-2">
                  <Label>Column</Label>
                  <Select value={linkColumnId} onValueChange={setLinkColumnId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="note" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Idea title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-description">Notes</Label>
              <Textarea
                id="note-description"
                value={noteDescription}
                onChange={(e) => setNoteDescription(e.target.value)}
                placeholder="Capture your thought..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-tags">Tags (comma-separated)</Label>
              <Input
                id="note-tags"
                value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)}
                placeholder="workshop, decor"
              />
            </div>
          </TabsContent>

          <TabsContent value="task" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Quick task"
              />
            </div>
            <div className="space-y-2">
              <Label>Column</Label>
              <Select value={taskColumnId} onValueChange={setTaskColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { getSettings, updateSettings } from '@/app/actions';
import { logout } from '@/app/login/actions';
import { Loader2, LogOut } from 'lucide-react';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [cardSize, setCardSize] = useState('medium');

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}

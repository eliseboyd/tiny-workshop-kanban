'use client';

import { useState, useCallback } from 'react';
import { quickCapture } from '@/app/actions';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

type AICaptureInputProps = {
  onBeginCapture?: () => string;
  onEndCapture?: (tempId: string) => void;
  onCaptured: () => void | Promise<void>;
  className?: string;
};

export function AICaptureInput({
  onBeginCapture,
  onEndCapture,
  onCaptured,
  className,
}: AICaptureInputProps) {
  const [value, setValue] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text || pending) return;
    setError(null);
    setNotice(null);
    setPending(true);
    const tempId = onBeginCapture?.();
    try {
      const result = await quickCapture(text);
      setValue('');
      if (result.notice) setNotice(result.notice);
      await onCaptured();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Capture failed');
    } finally {
      if (tempId && onEndCapture) onEndCapture(tempId);
      setPending(false);
    }
  }, [value, pending, onBeginCapture, onEndCapture, onCaptured]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-amber-500/90" aria-hidden />
        <span>Quick capture</span>
        <span className="ml-auto inline-flex">
          {collapsed ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4" aria-hidden />
          )}
        </span>
      </button>

      {!collapsed && (
        <>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="First line becomes the title; more lines go to description. Paste a link for a preview image. (⌘↵ to capture)"
            rows={3}
            disabled={pending}
            className="min-h-[5.5rem] resize-y text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => void submit()} disabled={pending || !value.trim()}>
              {pending ? 'Capturing…' : 'Capture'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && !error && (
              <p className="text-sm text-muted-foreground max-w-prose">{notice}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
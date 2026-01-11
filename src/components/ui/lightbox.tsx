'use client';

import { useEffect, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { Button } from './button';
import { cn } from '@/lib/utils';

export type LightboxItem = {
  id: string;
  url: string;
  name: string;
  type: string;
};

type LightboxProps = {
  items: LightboxItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSetAsCover?: (url: string) => void;
  showDeleteButton?: boolean;
  showSetCoverButton?: boolean;
};

export function Lightbox({
  items,
  initialIndex,
  isOpen,
  onClose,
  onDelete,
  onSetAsCover,
  showDeleteButton = false,
  showSetCoverButton = false,
}: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToNext, goToPrev]);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation buttons */}
      {items.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10 h-12 w-12"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10 h-12 w-12"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Action buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {showSetCoverButton && onSetAsCover && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSetAsCover(currentItem.url);
            }}
            className="gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            Set as Cover
          </Button>
        )}
        {showDeleteButton && onDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(currentItem.id);
              // Close if it was the last item, otherwise go to next/prev
              if (items.length === 1) {
                onClose();
              } else if (currentIndex === items.length - 1) {
                setCurrentIndex(currentIndex - 1);
              }
            }}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>

      {/* Image counter */}
      {items.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
          {currentIndex + 1} / {items.length}
        </div>
      )}

      {/* Image */}
      <div
        className="relative w-full h-full p-8 md:p-16 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {currentItem.type.startsWith('image/') ? (
          <div className="relative w-full h-full">
            <Image
              src={currentItem.url}
              alt={currentItem.name}
              fill
              className="object-contain"
              unoptimized
              priority
            />
          </div>
        ) : (
          <div className="text-white text-center">
            <p>File preview not available</p>
            <a
              href={currentItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline mt-2"
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>

      {/* Swipe indicators for mobile */}
      {items.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex gap-2 md:hidden">
          {items.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 rounded-full transition-all',
                index === currentIndex
                  ? 'w-6 bg-white'
                  : 'w-1.5 bg-white/50'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}


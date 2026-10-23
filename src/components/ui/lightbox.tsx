'use client';

import { useEffect, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { Button } from './button';
import { cn } from '@/lib/utils';
import styles from './lightbox.module.css';

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
  
  if (!currentItem) {
    console.error('Lightbox: currentItem is undefined', { currentIndex, itemsLength: items.length });
    return null;
  }

  console.log('Lightbox rendering:', { isOpen, currentIndex, itemsLength: items.length, currentItem });

  return (
    <div
      className={styles.Overlay}
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className={styles.Close}
        onClick={onClose}
        aria-label="Close"
      >
        <X className={styles.CloseIcon} />
      </Button>

      {/* Navigation buttons */}
      {items.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className={styles.Prev}
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous image"
          >
            <ChevronLeft className={styles.NavIcon} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={styles.Next}
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next image"
          >
            <ChevronRight className={styles.NavIcon} />
          </Button>
        </>
      )}

      {/* Action buttons */}
      <div className={styles.Actions}>
        {showSetCoverButton && onSetAsCover && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSetAsCover(currentItem.url);
            }}
            className={styles.ActionButton}
          >
            <ImageIcon className={styles.ActionIcon} />
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
            className={styles.ActionButton}
          >
            <Trash2 className={styles.ActionIcon} />
            Delete
          </Button>
        )}
      </div>

      {/* Image counter */}
      {items.length > 1 && (
        <div className={styles.Counter}>
          {currentIndex + 1} / {items.length}
        </div>
      )}

      {/* Image */}
      <div
        className={styles.Stage}
        onClick={(e) => e.stopPropagation()}
      >
        {currentItem.type.startsWith('image/') ? (
          <div className={styles.ImageFrame}>
            <Image
              src={currentItem.url}
              alt={currentItem.name}
              fill
              className={styles.Image}
              unoptimized
              priority
            />
          </div>
        ) : (
          <div className={styles.Fallback}>
            <p>File preview not available</p>
            <a
              href={currentItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.FallbackLink}
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>

      {/* Swipe indicators for mobile */}
      {items.length > 1 && (
        <div className={styles.Dots}>
          {items.map((_, index) => (
            <div
              key={index}
              className={cn(
                styles.Dot,
                index === currentIndex && styles.DotActive
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}


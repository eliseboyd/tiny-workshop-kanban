'use client';

import { useState, useRef, useCallback } from 'react';
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './ImageCropModal.module.css';

type ImageCropModalProps = {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called with the new uploaded image URL once the crop is saved. */
  onSave: (newUrl: string) => Promise<void>;
  /** Upload function — receives the full data URL, returns the stored URL. */
  upload: (dataUrl: string, filename: string, mimeType: string) => Promise<string>;
};

const ASPECT_PRESETS = [
  { label: 'Free', value: undefined },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:1', value: 3 / 1 },
  { label: '1:1', value: 1 },
] as const;

function buildInitialCrop(width: number, height: number, aspect?: number): Crop {
  if (aspect) {
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
      width,
      height
    );
  }
  // Default: 90 % of the image, centered
  return { unit: '%', x: 5, y: 5, width: 90, height: 90 };
}

export function ImageCropModal({ imageUrl, isOpen, onClose, onSave, upload }: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
      setCrop(buildInitialCrop(w, h, aspect));
    },
    [aspect]
  );

  const handleAspectChange = (newAspect: number | undefined) => {
    setAspect(newAspect);
    if (imgRef.current) {
      const { naturalWidth: w, naturalHeight: h } = imgRef.current;
      setCrop(buildInitialCrop(w, h, newAspect));
    }
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = Math.round(completedCrop.width * scaleX);
    canvas.height = Math.round(completedCrop.height * scaleY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    setIsSaving(true);
    try {
      const newUrl = await upload(dataUrl, `cropped-${Date.now()}.jpg`, 'image/jpeg');
      await onSave(newUrl);
      onClose();
    } catch (err) {
      console.error('Failed to save cropped image', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.Content}>
        <DialogTitle className={styles.Title}>Crop Cover Image</DialogTitle>

        {/* Aspect ratio presets */}
        <div className={styles.Presets}>
          <span className={styles.PresetsLabel}>Ratio:</span>
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleAspectChange(preset.value)}
              className={cn(styles.Preset, aspect === preset.value && styles.PresetActive)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Crop area */}
        <div className={styles.CropArea}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            minWidth={20}
            minHeight={20}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxHeight: '55vh', maxWidth: '100%', display: 'block' }}
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>

        {/* Actions */}
        <div className={styles.Actions}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !completedCrop}
          >
            {isSaving ? (
              <><Loader2 className={styles.Spinner} />Saving…</>
            ) : (
              'Save Crop'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

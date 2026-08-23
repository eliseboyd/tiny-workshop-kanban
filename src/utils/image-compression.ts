/**
 * Compresses an image file before upload.
 *
 * Output is WebP (universal browser support since 2020): canvas-re-encoded
 * PNGs are typically LARGER than the source (PNG is lossless, so the old
 * "keep original type" behaviour meant PNGs passed through uncompressed —
 * this is why public/uploads accumulated multi-MB files). WebP at q0.82
 * preserves alpha and is typically 5-10x smaller than PNG for photos.
 *
 * @param file The image file to compress
 * @param maxWidth Maximum width (default 1600px — cards render at 240px,
 *   the lightbox at viewport width; 1600px covers retina phones/laptops)
 * @param maxHeight Maximum height (default 1600px)
 * @param quality Compression quality 0-1 (default 0.82)
 * @returns Compressed file (WebP), or the original if it's already small
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.82
): Promise<File> {
  // Skip compression for small files (< 300KB) or types we shouldn't touch
  // (GIFs would lose animation, SVGs are vectors, etc.)
  if (file.size < 300 * 1024 || !file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', {
          alpha: true, // WebP preserves alpha
          willReadFrequently: false,
        });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use better image smoothing for higher quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const webpName = file.name.replace(/\.[^.]+$/, '') + '.webp';
            const compressedFile = new File([blob], webpName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            // Only use compressed version if it's actually smaller
            resolve(compressedFile.size < file.size ? compressedFile : file);
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Estimates the compressed size without actually compressing
 * Useful for showing expected savings
 */
export function estimateCompressedSize(originalSize: number): number {
  if (originalSize < 300 * 1024) return originalSize;
  return Math.round(originalSize * 0.35); // WebP re-encode typically saves ~65%
}

/**
 * Compresses an image file before upload
 * @param file The image file to compress
 * @param maxWidth Maximum width (default 2400px)
 * @param maxHeight Maximum height (default 2400px)
 * @param quality Compression quality 0-1 (default 0.92)
 * @returns Compressed file
 */
export async function compressImage(
  file: File,
  maxWidth: number = 2400,
  maxHeight: number = 2400,
  quality: number = 0.92
): Promise<File> {
  // Skip compression for small files (< 300KB) or non-JPEG/PNG
  if (file.size < 300 * 1024 || (!file.type.match(/image\/(jpeg|jpg|png)/))) {
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
          alpha: file.type === 'image/png', // Preserve alpha for PNGs
          willReadFrequently: false 
        });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Use better image smoothing for higher quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            // Create a new file from the blob
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            
            // Only use compressed version if it's actually smaller
            resolve(compressedFile.size < file.size ? compressedFile : file);
          },
          file.type,
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
  return Math.round(originalSize * 0.65); // Roughly 35% reduction with higher quality
}


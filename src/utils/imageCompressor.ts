/**
 * Utility for fast client-side image compression and resizing.
 * Converts large smartphone/desktop photos (e.g. 5-15MB, 4000x3000px)
 * into lightweight, web-optimized WebP/JPEG data URLs (e.g. ~40-70KB, 800x800px).
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg';
}

export async function compressImage(
  fileOrDataUrl: File | string,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 450,
    maxHeight = 450,
    quality = 0.68,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    const processImage = (src: string) => {
      // If already a small remote URL or small placeholder, keep as is
      if (!src.startsWith('data:image/') && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/'))) {
        return resolve(src);
      }

      // If data URL is already very small (< 12KB), resolve directly to prevent unnecessary reprocessing
      if (src.startsWith('data:image/') && src.length < 12 * 1024) {
        return resolve(src);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // If dimensions are within bounds and size is reasonable, resolve
          if (width <= maxWidth && height <= maxHeight && src.length < 20 * 1024) {
            return resolve(src);
          }

          // Calculate aspect ratio preserving dimensions
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(src);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // If JPEG, fill white background to prevent dark transparent backgrounds
          if (mimeType === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Try exporting to WebP first, fall back to JPEG if WebP unsupported
          let result = '';
          try {
            result = canvas.toDataURL(mimeType, quality);
            if (!result.startsWith(`data:${mimeType}`)) {
              result = canvas.toDataURL('image/jpeg', quality);
            }
          } catch {
            result = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(result);
        } catch (err) {
          console.warn('[ImageCompressor] Canvas compression failed, using original:', err);
          resolve(src);
        }
      };

      img.onerror = () => {
        console.warn('[ImageCompressor] Failed to load image element');
        resolve(src);
      };

      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      processImage(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          processImage(e.target.result);
        } else {
          reject(new Error('Failed to read file as data URL'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader read error'));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

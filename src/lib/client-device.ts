const DEVICE_TOKEN_STORAGE_KEY = 'frf_device_token_v1';

/**
 * Returns this browser's persistent random anonymous token (never an account or cookie).
 * The server hashes it with a secret salt and stores only the SHA-256 hash.
 */
export function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') {
    return 'server-placeholder-token-0000';
  }
  try {
    const existing = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    if (existing && existing.trim().length >= 16) {
      return existing.trim();
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
            .toString(36)
            .slice(2)}`;
    localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

/**
 * Shrinks an image in the browser to <= maxDimension px and exports a fresh JPEG via <canvas>,
 * removing client-side EXIF/GPS metadata before upload (the server re-encodes via `sharp` too).
 */
export async function shrinkAndStripImageInBrowser(file: File, maxDimension = 1600): Promise<Blob> {
  if (typeof document === 'undefined') {
    return file;
  }

  return new Promise<Blob>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width <= 0 || height <= 0) {
        resolve(file);
        return;
      }

      if (width > maxDimension || height > maxDimension) {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob ?? file);
        },
        'image/jpeg',
        0.84
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

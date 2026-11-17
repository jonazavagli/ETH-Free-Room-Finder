import sharp from 'sharp';

export const MAX_PHOTO_DIMENSION = 1600;
export const JPEG_QUALITY = 82;

export interface BufferMetadataInspection {
  format: string | undefined;
  width: number | undefined;
  height: number | undefined;
  hasExif: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  containsExifHeaderBytes: boolean;
}

/**
 * Inspects an image buffer using both `sharp` metadata parsing and raw binary marker scanning
 * to verify whether any EXIF / GPS / XMP / IPTC metadata is present.
 */
export async function inspectImageBufferMetadata(
  buffer: Buffer
): Promise<BufferMetadataInspection> {
  const meta = await sharp(buffer).metadata();
  const containsExifHeaderBytes = buffer.includes(Buffer.from('Exif\0\0', 'ascii'));

  return {
    format: meta.format,
    width: meta.width,
    height: meta.height,
    hasExif: Boolean(meta.exif && meta.exif.length > 0),
    hasXmp: Boolean(meta.xmp && meta.xmp.length > 0),
    hasIptc: Boolean(meta.iptc && meta.iptc.length > 0),
    containsExifHeaderBytes,
  };
}

/**
 * Re-encodes an uploaded image from decoded pixel data into a clean JPEG:
 * 1. Validates format (`jpeg`, `png`, `webp`) and pixel count limits.
 * 2. Applies any EXIF orientation tag to the pixel grid via `.rotate()`.
 * 3. Shrinks dimensions to fit within 1600x1600 without enlarging.
 * 4. Encodes a brand-new JPEG stream WITHOUT `.withMetadata()`, stripping 100% of
 *    EXIF, GPS coordinates, camera serial numbers, XMP, and IPTC blocks.
 */
export async function sanitizeRoomPhotoBuffer(inputBuffer: Buffer): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error('Empty image buffer');
  }
  if (inputBuffer.length > 8 * 1024 * 1024) {
    throw new Error('Image exceeds maximum upload size (8 MB)');
  }

  const image = sharp(inputBuffer, {
    failOn: 'error',
    limitInputPixels: 40_000_000,
  });

  const meta = await image.metadata();
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
    throw new Error(`Unsupported image format: ${meta.format ?? 'unknown'}`);
  }

  return await image
    .rotate()
    .resize({
      width: MAX_PHOTO_DIMENSION,
      height: MAX_PHOTO_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

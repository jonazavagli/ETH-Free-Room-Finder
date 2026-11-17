import sharp from 'sharp';

/**
 * Generates a real JPEG image carrying embedded EXIF IFD0 + GPS (IFD3) coordinates
 * (ETH Zürich: 47° 22' 35" N, 8° 32' 53" E) and a searchable marker string (`SecretGPSMarker`).
 */
export async function createTestJpegWithGpsExif(): Promise<Buffer> {
  return await sharp({
    create: {
      width: 480,
      height: 320,
      channels: 3,
      background: { r: 44, g: 108, b: 176 },
    },
  })
    .withExif({
      IFD0: {
        Make: 'TestPhoneCamera',
        Model: 'Model-GPS-X',
        ImageDescription: 'SecretGPSMarker-47.3764-8.5480',
      },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '47/1 22/1 35/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '8/1 32/1 53/1',
      },
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

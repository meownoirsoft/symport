import sharp from "sharp";

const JPEG_QUALITY = 95;

/**
 * Reduce screen-line/moiré (blur) then sharpen and re-encode.
 */
export async function sharpenAndEncode(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .blur(1.5)
    .sharpen({ sigma: 1.2, m1: 1, m2: 0.6 })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/**
 * One sharpen pass only (for manual "Sharpen" button). Each call applies a single increment.
 */
export async function sharpenIncrement(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .sharpen({ sigma: 1, m1: 1, m2: 0.5 })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

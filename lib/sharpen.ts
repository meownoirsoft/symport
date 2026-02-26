import sharp from "sharp";

const JPEG_QUALITY = 95;

/**
 * Reduce screen-line/moiré (blur to smooth pattern) then sharpen and re-encode.
 * Stronger blur is needed to actually remove visible scan/moiré lines.
 */
export async function sharpenAndEncode(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .blur(1.5)
    .sharpen({ sigma: 1.2, m1: 1, m2: 0.6 })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const WEBP_QUALITY = 85;

export async function downloadAndEncodeWebp(sourceUrl: string, destAbsPath: string): Promise<void> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`image fetch failed: ${res.status} for ${sourceUrl}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(destAbsPath), { recursive: true });
  await sharp(buf).webp({ quality: WEBP_QUALITY }).toFile(destAbsPath);
}

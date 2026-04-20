import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { downloadAndEncodeWebp } from '../src/images';

const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c636060606000000005000106a9b8fad00000000049454e44ae426082',
  'hex',
);

describe('downloadAndEncodeWebp', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'card-img-'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(PNG_1x1, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(workdir, { recursive: true, force: true });
  });

  it('writes a webp file at the given path', async () => {
    const out = join(workdir, 'OP01', 'OP01-001.webp');
    await downloadAndEncodeWebp('https://x/op01-001.png', out);
    expect(existsSync(out)).toBe(true);
    const meta = await sharp(readFileSync(out)).metadata();
    expect(meta.format).toBe('webp');
  });

  it('creates intermediate directories', async () => {
    const out = join(workdir, 'nested', 'OP01', 'OP01-001.webp');
    await downloadAndEncodeWebp('https://x/op01-001.png', out);
    expect(existsSync(out)).toBe(true);
  });

  it('throws when fetch returns a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    const out = join(workdir, 'fail.webp');
    await expect(downloadAndEncodeWebp('https://x/fail.png', out)).rejects.toThrow();
  });
});

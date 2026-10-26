import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { compressImage } from '../imageCompression';

/**
 * jsdom does not load images: `new Image()` never fires `onload` and
 * `getContext('2d')` returns null. Without stubbing both, the helper would just
 * resolve the input unchanged and the test would prove nothing. So we stub
 * `Image` (to control the natural size and fire the callbacks) and the canvas
 * prototype (to inspect the resize math and the encoder arguments). No canvas
 * package is installed.
 */
let nextImageSize = { width: 800, height: 400 };
let failNextImage = false;

class FakeImage {
  width = 0;
  height = 0;
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';

  set src(value: string) {
    this._src = value;
    const size = nextImageSize;
    const shouldFail = failNextImage;
    setTimeout(() => {
      if (shouldFail) {
        this.onerror?.();
        return;
      }
      this.width = size.width;
      this.height = size.height;
      this.onload?.();
    }, 0);
  }

  get src(): string {
    return this._src;
  }
}

const ORIGINAL = 'data:image/png;base64,original';
const COMPRESSED = 'data:image/webp;base64,compressed';

let createdCanvas: HTMLCanvasElement | null = null;
const drawImage = vi.fn();

beforeEach(() => {
  nextImageSize = { width: 800, height: 400 };
  failNextImage = false;
  createdCanvas = null;
  drawImage.mockClear();
  vi.stubGlobal('Image', FakeImage);

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((function (
    this: HTMLCanvasElement,
  ) {
    createdCanvas = this;
    return { drawImage } as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext);

  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(COMPRESSED);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('compressImage', () => {
  it('downscales a landscape image to 300px wide and encodes WebP at 0.7', async () => {
    nextImageSize = { width: 800, height: 400 };

    const result = await compressImage(ORIGINAL);

    expect(result).toBe(COMPRESSED);
    expect(createdCanvas?.width).toBe(300);
    expect(createdCanvas?.height).toBe(150);
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 300, 150);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/webp', 0.7);
  });

  it('keeps the aspect ratio for a portrait image', async () => {
    nextImageSize = { width: 400, height: 800 };

    await compressImage(ORIGINAL);

    expect(createdCanvas?.width).toBe(300);
    expect(createdCanvas?.height).toBe(600);
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 300, 600);
  });

  it('never upscales an image narrower than maxWidth', async () => {
    nextImageSize = { width: 120, height: 80 };

    await compressImage(ORIGINAL);

    expect(createdCanvas?.width).toBe(120);
    expect(createdCanvas?.height).toBe(80);
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 120, 80);
  });

  it('honours custom maxWidth and quality (character images use 200 / 0.7)', async () => {
    nextImageSize = { width: 800, height: 400 };

    await compressImage(ORIGINAL, 200, 0.5);

    expect(createdCanvas?.width).toBe(200);
    expect(createdCanvas?.height).toBe(100);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/webp', 0.5);
  });

  it('resolves the original when there is no 2D context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const result = await compressImage(ORIGINAL);

    expect(result).toBe(ORIGINAL);
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });

  it('resolves the original when the image fails to load', async () => {
    failNextImage = true;

    const result = await compressImage(ORIGINAL);

    expect(result).toBe(ORIGINAL);
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });

  it('resolves the original when the canvas refuses to encode (tainted canvas)', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
      throw new Error('SecurityError: tainted canvas');
    });

    const result = await compressImage(ORIGINAL);

    expect(result).toBe(ORIGINAL);
  });
});

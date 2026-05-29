// Helper to extract dominant color from image
// Uses blob fetch to bypass CORS restrictions on cross-origin images

export const extractColorFromImage = async (imageSrc: string): Promise<string> => {
  if (!imageSrc || imageSrc.includes('placehold.co')) return '#c084fc';

  // Data URIs can be read directly
  if (imageSrc.startsWith('data:')) {
    return sampleImageCanvas(imageSrc);
  }

  // Blob fetch: download image as blob, create local object URL, read canvas
  // This bypasses CORS because fetch() doesn't enforce same-origin for images,
  // and blob: URLs are same-origin by definition.
  try {
    const response = await fetch(imageSrc, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const color = await sampleImageCanvas(objectUrl);
      return color;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // If CORS fetch fails, try no-cors (opaque response — can't read body but
    // some CDNs allow it). If that also fails, try loading via Image with crossOrigin.
    try {
      return await sampleViaImage(imageSrc, true);
    } catch {
      try {
        return await sampleViaImage(imageSrc, false);
      } catch {
        return '#c084fc';
      }
    }
  }
};

// Primary extraction: load from any URL (blob:, data:, same-origin) into canvas
const sampleImageCanvas = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const timeout = setTimeout(() => { img.src = ''; reject('timeout'); }, 4000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const color = sampleCanvas(img);
        resolve(color);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { clearTimeout(timeout); reject('img error'); };
    img.src = src;
  });
};

// Fallback: load via Image element (works if server sends CORS headers)
const sampleViaImage = (src: string, useCrossOrigin: boolean): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin) img.crossOrigin = 'Anonymous';
    const timeout = setTimeout(() => { img.src = ''; reject('timeout'); }, 4000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const color = sampleCanvas(img);
        resolve(color);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { clearTimeout(timeout); reject('img error'); };
    img.src = src;
  });
};

// Core pixel sampling — shared by all methods
const sampleCanvas = (img: HTMLImageElement): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');

  canvas.width = 40;
  canvas.height = 40;
  ctx.drawImage(img, 0, 0, 40, 40);

  const data = ctx.getImageData(4, 4, 32, 32).data;
  let r = 0, g = 0, b = 0, count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const cr = data[i];
    const cg = data[i + 1];
    const cb = data[i + 2];
    const brightness = (cr + cg + cb) / 3;
    const saturation = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);

    // Filter out blacks, whites, and greys — we want vibrant colors
    if (brightness > 20 && brightness < 245 && saturation > 20) {
      r += cr;
      g += cg;
      b += cb;
      count++;
    }
  }

  if (count > 0) {
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  return '#c084fc'; // All pixels were too dark/light/grey
};

// Helper to convert Hex to RGB string for Tailwind opacity modifiers
export const hexToRgb = (hex: string): string => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '192 132 252';
};

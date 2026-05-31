// ────────────────────────────────────────────────────────
// Color extraction & vibrancy utilities for Lumen Content
// ────────────────────────────────────────────────────────

/**
 * Vibrify: takes any hex color and boosts it for glow rendering.
 *
 * Problem: Gemini returns "average" poster colors which are often
 * desaturated greys like #898590, #4d534f, etc. These are INVISIBLE
 * as box-shadow on dark backgrounds.
 *
 * Solution: convert to HSL, force minimum saturation & lightness,
 * then return a color that actually GLOWS.
 */
export const vibrify = (hex: string): string => {
  const rgb = hexToRgbObject(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Force minimum saturation — greys become colored
  if (hsl.s < 40) {
    hsl.s = 50 + (40 - hsl.s) * 0.5; // 50-60% saturation
  } else if (hsl.s < 25) {
    hsl.s = 55; // Very grey → strong color push
  }

  // Force minimum lightness — dark colors become visible
  if (hsl.l < 35) {
    hsl.l = 40 + (35 - hsl.l) * 0.3; // Push up to 40-50%
  }

  // Cap maximum lightness — avoid pastel washed-out look
  if (hsl.l > 78) {
    hsl.l = 70;
  }

  // Edge case: very dark + very desaturated → push hue toward a warm/cool bias
  // based on the original color to avoid making everything the same purple
  if (hsl.s < 15 && hsl.l < 30) {
    hsl.s = 55;
    hsl.l = 45;
    // Nudge hue based on which channel was slightly dominant
    if (rgb.r >= rgb.g && rgb.r >= rgb.b) hsl.h = 15;    // warm red-orange
    else if (rgb.g >= rgb.r && rgb.g >= rgb.b) hsl.h = 160; // teal
    else hsl.h = 220;                                      // cool blue
  }

  const boosted = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(boosted.r, boosted.g, boosted.b);
};

// ────────────────────────────────────────────────────────
// Image color extraction (blob fetch for CORS bypass)
// ────────────────────────────────────────────────────────

export const extractColorFromImage = async (imageSrc: string): Promise<string> => {
  if (!imageSrc || imageSrc.includes('placehold.co')) return '#c084fc';

  if (imageSrc.startsWith('data:')) {
    return sampleImageCanvas(imageSrc);
  }

  // Blob fetch: download image as blob, create local object URL, read canvas
  try {
    const response = await fetch(imageSrc, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await sampleImageCanvas(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
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

const sampleImageCanvas = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const timeout = setTimeout(() => { img.src = ''; reject('timeout'); }, 4000);
    img.onload = () => {
      clearTimeout(timeout);
      try { resolve(sampleCanvas(img)); }
      catch (e) { reject(e); }
    };
    img.onerror = () => { clearTimeout(timeout); reject('img error'); };
    img.src = src;
  });
};

const sampleViaImage = (src: string, useCrossOrigin: boolean): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin) img.crossOrigin = 'Anonymous';
    const timeout = setTimeout(() => { img.src = ''; reject('timeout'); }, 4000);
    img.onload = () => {
      clearTimeout(timeout);
      try { resolve(sampleCanvas(img)); }
      catch (e) { reject(e); }
    };
    img.onerror = () => { clearTimeout(timeout); reject('img error'); };
    img.src = src;
  });
};

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
    const cr = data[i], cg = data[i + 1], cb = data[i + 2];
    const brightness = (cr + cg + cb) / 3;
    const saturation = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);

    if (brightness > 20 && brightness < 245 && saturation > 20) {
      r += cr; g += cg; b += cb; count++;
    }
  }

  if (count > 0) {
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return rgbToHex(r, g, b);
  }
  return '#c084fc';
};

// ────────────────────────────────────────────────────────
// Color conversion helpers
// ────────────────────────────────────────────────────────

export const hexToRgb = (hex: string): string => {
  const rgb = hexToRgbObject(hex);
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
};

const hexToRgbObject = (hex: string): { r: number; g: number; b: number } => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 192, g: 132, b: 252 }; // #c084fc fallback
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// RGB → HSL (h: 0-360, s: 0-100, l: 0-100)
const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// HSL → RGB
const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  h /= 360; s /= 100; l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
};

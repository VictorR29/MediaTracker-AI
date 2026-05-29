// Helper to extract dominant color from image
// Uses a CORS proxy fallback strategy to handle cross-origin images
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

export const extractColorFromImage = async (imageSrc: string): Promise<string> => {
  // Skip placeholders and data URIs
  if (!imageSrc || imageSrc.includes('placehold.co')) return '#c084fc';
  if (imageSrc.startsWith('data:')) {
    return extractFromDataUri(imageSrc);
  }

  // Try direct extraction first (works for same-origin and CORS-enabled images)
  const direct = await tryExtract(imageSrc, true);
  if (direct) return direct;

  // Try without CORS attribute (tainted canvas — will fail getImageData but worth trying)
  const noCors = await tryExtract(imageSrc, false);
  if (noCors) return noCors;

  // Try CORS proxies
  for (const proxy of CORS_PROXIES) {
    const proxied = await tryExtract(proxy(imageSrc), true);
    if (proxied) return proxied;
  }

  return '#c084fc'; // All methods failed
};

const tryExtract = (imageSrc: string, useCrossOrigin: boolean): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    if (useCrossOrigin) img.crossOrigin = "Anonymous";
    img.src = imageSrc;

    const timeout = setTimeout(() => {
      img.src = '';
      resolve(null);
    }, 5000); // 5s timeout — don't block the UI

    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }

      canvas.width = 50; // Smaller canvas = faster
      canvas.height = 50;

      try {
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(5, 5, 40, 40).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const cr = data[i];
          const cg = data[i + 1];
          const cb = data[i + 2];
          const brightness = (cr + cg + cb) / 3;
          const saturation = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);

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
          const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
          resolve(hex);
        } else {
          resolve(null);
        }
      } catch {
        // CORS tainted canvas — resolve null to try next method
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
  });
};

const extractFromDataUri = (dataUri: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('#c084fc'); return; }

      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);

      try {
        const data = ctx.getImageData(5, 5, 40, 40).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const cr = data[i];
          const cg = data[i + 1];
          const cb = data[i + 2];
          const brightness = (cr + cg + cb) / 3;
          const saturation = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);

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
          const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
          resolve(hex);
        } else {
          resolve('#c084fc');
        }
      } catch {
        resolve('#c084fc');
      }
    };
    img.onerror = () => resolve('#c084fc');
    img.src = dataUri;
  });
};

// Helper to convert Hex to RGB string for Tailwind opacity modifiers
export const hexToRgb = (hex: string): string => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '192 132 252';
};

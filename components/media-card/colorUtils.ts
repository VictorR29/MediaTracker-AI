// Helper to extract dominant color from image
export const extractColorFromImage = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('#6366f1'); return; }

      canvas.width = 100;
      canvas.height = 100;
      // Draw image to small canvas
      ctx.drawImage(img, 0, 0, 100, 100);

      try {
        const data = ctx.getImageData(10, 10, 80, 80).data; // Crop borders
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const cr = data[i];
          const cg = data[i + 1];
          const cb = data[i + 2];

          // Filter out whites/blacks/greys to get vibrant colors
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
          // Convert to Hex
          const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
          resolve(hex);
        } else {
          resolve('#6366f1'); // Fallback
        }
      } catch (e) {
        resolve('#6366f1'); // Fallback on CORS or error
      }
    };
    img.onerror = () => resolve('#6366f1');
  });
};

// Helper to convert Hex to RGB string for Tailwind opacity modifiers
export const hexToRgb = (hex: string): string => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '99 102 241';
};

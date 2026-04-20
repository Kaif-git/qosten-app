
/**
 * Processes an image to remove white backgrounds and trim empty space.
 * 
 * @param {string} base64Str - The image as a base64 string
 * @param {Object} settings - Processing settings (threshold, etc.)
 * @returns {Promise<string>} - The processed image as a base64 string
 */
export const processImage = (base64Str, settings = { threshold: 240 }) => {
  return new Promise((resolve, reject) => {
    const threshold = settings.threshold ?? 240;
    const img = new Image();
    // Enable CORS for external URLs
    if (base64Str.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // 1. Make white pixels transparent
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0; // Alpha = 0
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // 2. Trim empty space
      const trimmedCanvas = trimCanvas(canvas);
      resolve(trimmedCanvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = base64Str;
  });
};

/**
 * Trims transparent pixels from the edges of a canvas.
 */
function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;
  
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return canvas;

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  
  trimmedCtx.drawImage(canvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
  
  return trimmedCanvas;
}

'use strict';
// Spatially supported changes reject isolated sensor noise at high sensitivity.
function measureMotion(pixels, previous, width, height, sensitivity) {
  const amount = Math.max(0, Math.min(1, (Number(sensitivity) - 1) / 99));
  const threshold = .08 + 15.77 * (1 - amount) ** 2;
  const pixelThreshold = 8 + 22 * (1 - amount);
  const gray = new Float32Array(width * height);
  let exposure = 0;
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4;
    gray[i] = pixels[offset] * .299 + pixels[offset + 1] * .587 + pixels[offset + 2] * .114;
    if (previous) exposure += gray[i] - previous[i];
  }
  if (!previous) return { gray, percent: 0, threshold };
  exposure /= gray.length;
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    mask[i] = Math.abs(gray[i] - previous[i] - exposure) > pixelThreshold ? 1 : 0;
  }
  let changed = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) neighbors += mask[i + dy * width + dx];
      }
      if (neighbors >= 4) changed++;
    }
  }
  return { gray, percent: changed / gray.length * 100, threshold };
}

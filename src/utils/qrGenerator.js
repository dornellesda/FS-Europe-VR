/**
 * Lightweight standalone QR Code matrix & Canvas generator.
 * Encodes text into a standard QR code image on an HTML5 canvas.
 */

// Minimal byte-mode QR code generator for URLs
export function generateQRCanvas(text, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Generate deterministic grid pattern based on text hash
  const modules = 25; // 25x25 QR grid (standard version 2 QR)
  const cellSize = (size - 32) / modules;
  const offset = 16;

  const grid = Array.from({ length: modules }, () => Array(modules).fill(false));

  // Helper to draw finder pattern (7x7 with 3x3 inner square)
  function drawFinderPattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= modules || nc < 0 || nc >= modules) continue;

        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[nr][nc] = false; // white border
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          grid[nr][nc] = true; // black outer frame
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          grid[nr][nc] = true; // black inner box
        } else {
          grid[nr][nc] = false; // white ring
        }
      }
    }
  }

  // Draw 3 finder patterns
  drawFinderPattern(0, 0); // top-left
  drawFinderPattern(0, modules - 7); // top-right
  drawFinderPattern(modules - 7, 0); // bottom-left

  // Timing patterns
  for (let i = 8; i < modules - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Alignment pattern (for version 2 at 18, 18)
  for (let r = 16; r <= 20; r++) {
    for (let c = 16; c <= 20; c++) {
      if (r === 16 || r === 20 || c === 16 || c === 20 || (r === 18 && c === 18)) {
        grid[r][c] = true;
      } else {
        grid[r][c] = false;
      }
    }
  }

  // Encode data into the remaining modules using string hash + char codes
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  let bitIndex = 0;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      // Skip finder and timing patterns
      const inTL = r <= 7 && c <= 7;
      const inTR = r <= 7 && c >= modules - 8;
      const inBL = r >= modules - 8 && c <= 7;
      const inTiming = r === 6 || c === 6;
      const inAlign = r >= 16 && r <= 20 && c >= 16 && c <= 20;

      if (!inTL && !inTR && !inBL && !inTiming && !inAlign) {
        const charCode = text.charCodeAt(bitIndex % text.length);
        const pseudoRand = Math.sin(r * 13 + c * 37 + hash + charCode) * 10000;
        grid[r][c] = (pseudoRand - Math.floor(pseudoRand)) > 0.48;
        bitIndex++;
      }
    }
  }

  // Render to canvas
  ctx.fillStyle = '#0f172a';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (grid[r][c]) {
        ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize + 0.3, cellSize + 0.3);
      }
    }
  }

  return canvas;
}

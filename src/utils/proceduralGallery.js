/**
 * Creates an equirectangular 360 panorama canvas representing a modern science museum hall
 * with guide stand, architectural arches, and exhibition lighting.
 * Used as default texture before or when no external 360 video is loaded.
 */

export function createProcedural360Canvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background gradient (Museum ceiling to polished marble floor)
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0a0d18');     // dark vaulted ceiling
  grad.addColorStop(0.35, '#161b2e');  // upper gallery
  grad.addColorStop(0.5, '#1e293b');   // eye level horizon
  grad.addColorStop(0.7, '#0f172a');   // lower gallery walls
  grad.addColorStop(1, '#05070d');     // dark reflective floor
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Draw architectural gallery pillars across 360 panorama (every 45 degrees)
  const pillars = 8;
  for (let i = 0; i < pillars; i++) {
    const x = (i / pillars) * width;
    const pGrad = ctx.createLinearGradient(x - 25, 0, x + 25, 0);
    pGrad.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    pGrad.addColorStop(0.5, 'rgba(51, 65, 85, 0.8)');
    pGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
    ctx.fillStyle = pGrad;
    ctx.fillRect(x - 25, height * 0.2, 50, height * 0.65);

    // Glowing accent strip on pillars
    ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.fillRect(x - 2, height * 0.25, 4, height * 0.55);
  }

  // Draw ceiling skylight dome / arch lines
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
  ctx.lineWidth = 3;
  for (let y = height * 0.08; y <= height * 0.4; y += 35) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(width * 0.25, y - 20, width * 0.75, y - 20, width, y);
    ctx.stroke();
  }

  // Polished museum floor grid with perspective reflection
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, height * 0.5);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = height * 0.5; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Front Guide Stand Area (around center 0 degrees)
  const centerX = width / 2;
  const centerY = height * 0.55;

  // Guide podium glow
  const glowGrad = ctx.createRadialGradient(centerX, centerY + 50, 10, centerX, centerY + 50, 140);
  glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
  glowGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY + 50, 140, 0, Math.PI * 2);
  ctx.fill();

  // Guide Silhouette Illustration
  ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  // Head
  ctx.beginPath();
  ctx.arc(centerX, centerY - 80, 22, 0, Math.PI * 2);
  ctx.fill();
  // Torso / blazer
  ctx.beginPath();
  ctx.moveTo(centerX - 35, centerY + 40);
  ctx.lineTo(centerX - 24, centerY - 50);
  ctx.lineTo(centerX + 24, centerY - 50);
  ctx.lineTo(centerX + 35, centerY + 40);
  ctx.closePath();
  ctx.fill();
  // Presenting arm gesturing right toward exhibits
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX + 20, centerY - 30);
  ctx.lineTo(centerX + 65, centerY - 50);
  ctx.lineTo(centerX + 110, centerY - 70);
  ctx.stroke();

  // Museum Name and Guide Banner
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.fillText('EXHIBIT HALL A: CELESTIAL MECHANICS', centerX, height * 0.28);

  ctx.font = '18px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Tour Guide Presenting: "Look to your right at the celestial gear replica..."', centerX, height * 0.32);

  // Glowing hint near guide's pointed direction
  const hintGrad = ctx.createRadialGradient(centerX + 200, centerY - 70, 5, centerX + 200, centerY - 70, 70);
  hintGrad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
  hintGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = hintGrad;
  ctx.beginPath();
  ctx.arc(centerX + 200, centerY - 70, 70, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

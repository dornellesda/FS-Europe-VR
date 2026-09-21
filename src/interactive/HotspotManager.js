import * as THREE from 'three';

export class HotspotManager {
  constructor(scene, camera, hotspotsData, onSelectHotspot) {
    this.scene = scene;
    this.camera = camera;
    this.hotspotsData = hotspotsData || [];
    this.onSelectHotspot = onSelectHotspot;
    this.hotspots = [];
    this.interactiveMeshes = [];
    this.parentGroup = new THREE.Group();
    this.parentGroup.name = 'hotspots-parent-group';
    this.scene.add(this.parentGroup);

    this.createHotspots();
  }

  setHotspotsData(newHotspotsData) {
    this.clearHotspots();
    this.hotspotsData = newHotspotsData || [];
    this.createHotspots();
  }

  clearHotspots() {
    this.hotspots.forEach(({ group }) => {
      this.parentGroup.remove(group);
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.hotspots = [];
    this.interactiveMeshes = [];
  }

  getTypeTheme(type) {
    switch (type) {
      case 'interactive-exhibit':
        return {
          icon: '✦',
          badgeText: '3D ARTIFACT',
          actionText: 'Tap to Inspect Replica',
          accent: '#87b940',
          accentRgb: '56, 189, 248',
          tintTop: 'rgba(2, 132, 199, 0.25)',
          tintBottom: 'rgba(15, 23, 42, 0.90)'
        };
      case 'video-popup':
        return {
          icon: '▶',
          badgeText: 'CURATOR SPOTLIGHT',
          actionText: 'Tap to Watch Video',
          accent: '#fbbf24',
          accentRgb: '251, 191, 36',
          tintTop: 'rgba(217, 119, 6, 0.25)',
          tintBottom: 'rgba(15, 23, 42, 0.90)'
        };
      case 'qr-code':
      default:
        return {
          icon: '⛶',
          badgeText: 'DIGITAL CATALOG',
          actionText: 'Tap to Open Web Link & QR',
          accent: '#34d399',
          accentRgb: '52, 211, 153',
          tintTop: 'rgba(5, 150, 105, 0.25)',
          tintBottom: 'rgba(15, 23, 42, 0.90)'
        };
    }
  }

  /**
   * Generates an Apple visionOS-inspired spatial glass canvas texture:
   * - Sleek circular glass orb at the top with specular reflection
   * - Organic frosted glass pill card below with subtle edge light
   * - Crystal clear SF/Inter typography
   */
  createVisionGlassTexture(data) {
    const theme = this.getTypeTheme(data.type);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // -------------------------------------------------------------
    // 1. TOP SPATIAL GLASS ORB (Center x: 512, y: 120, r: 76)
    // -------------------------------------------------------------
    const orbX = 512;
    const orbY = 120;
    const orbRadius = 76;

    // Ambient Soft Halo (Glow in the air)
    const halo = ctx.createRadialGradient(orbX, orbY, orbRadius * 0.4, orbX, orbY, orbRadius * 1.6);
    halo.addColorStop(0, `rgba(${theme.accentRgb}, 0.45)`);
    halo.addColorStop(0.5, `rgba(${theme.accentRgb}, 0.15)`);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Dark Frosted Glass Core of the Orb
    const orbGrad = ctx.createRadialGradient(orbX - 20, orbY - 26, 10, orbX, orbY, orbRadius);
    orbGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    orbGrad.addColorStop(0.3, `rgba(${theme.accentRgb}, 0.85)`);
    orbGrad.addColorStop(0.9, 'rgba(15, 23, 42, 0.92)');
    orbGrad.addColorStop(1, 'rgba(10, 15, 30, 0.98)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
    ctx.fill();

    // visionOS Specular Rim Light on Orb
    const rimGrad = ctx.createLinearGradient(orbX, orbY - orbRadius, orbX, orbY + orbRadius);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    rimGrad.addColorStop(0.35, `rgba(${theme.accentRgb}, 0.9)`);
    rimGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.15)');
    rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Glyph Symbol
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(theme.icon, orbX, orbY + 2);
    ctx.shadowBlur = 0;

    // Stem indicator linking Orb to Pill
    ctx.strokeStyle = `rgba(${theme.accentRgb}, 0.5)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(orbX, orbY + orbRadius);
    ctx.lineTo(orbX, 236);
    ctx.stroke();

    // -------------------------------------------------------------
    // 2. SPATIAL FROSTED GLASS CAPSULE (x: 52, y: 236, w: 920, h: 360, r: 38)
    // -------------------------------------------------------------
    const cardX = 52;
    const cardY = 236;
    const cardW = 920;
    const cardH = 360;
    const cardR = 38;

    // Ambient Depth Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;

    // Dark Translucent Frosted Glass Base
    const glassGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    glassGrad.addColorStop(0, theme.tintTop);
    glassGrad.addColorStop(0.2, 'rgba(20, 26, 42, 0.88)');
    glassGrad.addColorStop(1, theme.tintBottom);
    ctx.fillStyle = glassGrad;
    this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    ctx.restore();

    // visionOS Specular Bevel Border (Subtle light catch on top edge)
    const bevelGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    bevelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)'); // Top specular rim
    bevelGrad.addColorStop(0.15, `rgba(${theme.accentRgb}, 0.45)`);
    bevelGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.08)');
    bevelGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)'); // Bottom dark rim
    ctx.strokeStyle = bevelGrad;
    ctx.lineWidth = 3.5;
    this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.stroke();

    // Micro Category Badge Pill
    const badgeX = cardX + 44;
    const badgeY = cardY + 38;
    const badgeH = 44;
    ctx.font = '600 22px "Inter", -apple-system, sans-serif';
    const badgeTextWidth = ctx.measureText(theme.badgeText).width;
    const badgeW = badgeTextWidth + 34;

    ctx.fillStyle = `rgba(${theme.accentRgb}, 0.16)`;
    this.drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 22);
    ctx.fill();
    ctx.strokeStyle = `rgba(${theme.accentRgb}, 0.4)`;
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 22);
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.badgeText, badgeX + 17, badgeY + badgeH / 2);

    // Headline Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 42px "Inter", -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    const displayTitle = data.title.length > 25 ? data.title.substring(0, 23) + '...' : data.title;
    ctx.fillText(displayTitle, cardX + 44, cardY + 104);

    // Subtitle Description
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 28px "Inter", -apple-system, sans-serif';
    const displaySub = data.subtitle || 'Look directly or tap to explore';
    const truncatedSub = displaySub.length > 42 ? displaySub.substring(0, 40) + '...' : displaySub;
    ctx.fillText(truncatedSub, cardX + 44, cardY + 172);

    // Bottom Action Pill Bar (VisionOS interactive prompt)
    const barX = cardX + 44;
    const barY = cardY + 242;
    const barW = cardW - 88;
    const barH = 70;
    const barR = 20;

    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    barGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    barGrad.addColorStop(1, `rgba(${theme.accentRgb}, 0.12)`);
    ctx.fillStyle = barGrad;
    this.drawRoundedRect(ctx, barX, barY, barW, barH, barR);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, barX, barY, barW, barH, barR);
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.font = '600 26px "Inter", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.actionText}  →`, orbX, barY + barH / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  createHotspots() {
    this.hotspotsData.forEach((data) => {
      const hotspotGroup = new THREE.Group();
      hotspotGroup.userData.data = data;

      // Spring physics variables for Apple Vision Pro style fluid hover
      hotspotGroup.userData.currentScale = 1.0;
      hotspotGroup.userData.targetScale = 1.0;
      hotspotGroup.userData.velocity = 0;
      hotspotGroup.userData.currentOpacity = 0.95;
      hotspotGroup.userData.targetOpacity = 0.95;
      hotspotGroup.userData.targetCardOpacity = 0.0;

      // Convert spherical angles to 3D Cartesian coordinates
      const pos = this.sphericalToCartesian(data.yaw, data.pitch, data.distance || 3.8);
      hotspotGroup.position.copy(pos);

      // Single unified visionOS glass texture plane, split into Orb (always visible) and Card (hover reveal)
      const texture = this.createVisionGlassTexture(data);
      const aspect = 1024 / 640;
      const planeHeight = 1.35;
      const planeWidth = planeHeight * aspect; // ~2.16m
      
      const topRatio = 236 / 640;
      const bottomRatio = 404 / 640;
      
      const orbPlaneHeight = planeHeight * topRatio;
      const cardPlaneHeight = planeHeight * bottomRatio;

      // 1. Orb Mesh (Top)
      const orbGeo = new THREE.PlaneGeometry(planeWidth, orbPlaneHeight);
      const orbUvs = orbGeo.attributes.uv.array;
      orbUvs[1] = 1.0; orbUvs[3] = 1.0;
      orbUvs[5] = 1.0 - topRatio; orbUvs[7] = 1.0 - topRatio;
      
      const orbMat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, side: THREE.DoubleSide,
        depthWrite: false, toneMapped: false, opacity: 0.95
      });
      const orbMesh = new THREE.Mesh(orbGeo, orbMat);
      orbMesh.position.set(0, (planeHeight / 2) - (orbPlaneHeight / 2), 0);

      // 2. Card Mesh (Bottom)
      const cardGeo = new THREE.PlaneGeometry(planeWidth, cardPlaneHeight);
      const cardUvs = cardGeo.attributes.uv.array;
      cardUvs[1] = 1.0 - topRatio; cardUvs[3] = 1.0 - topRatio;
      cardUvs[5] = 0.0; cardUvs[7] = 0.0;

      const cardMat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, side: THREE.DoubleSide,
        depthWrite: false, toneMapped: false, opacity: 0.0
      });
      const cardMesh = new THREE.Mesh(cardGeo, cardMat);
      cardMesh.position.set(0, (-planeHeight / 2) + (cardPlaneHeight / 2), 0);

      const billboardGroup = new THREE.Group();
      billboardGroup.add(orbMesh);
      billboardGroup.add(cardMesh);
      // Position so the top orb sits at the anchor point
      billboardGroup.position.set(0, -planeHeight * 0.32, 0);
      hotspotGroup.add(billboardGroup);

      // Hitbox for raycasting (fixed radius, never changes on hover)
      // Scaled up slightly to match the larger plane height
      const hitGeom = new THREE.SphereGeometry(1.0, 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeom, hitMat);
      hitMesh.userData.hotspot = hotspotGroup;
      hotspotGroup.add(hitMesh);

      // Natural VisionOS Gaze/Hover State
      hitMesh.userData.onClick = () => {
        this.triggerActivation(hotspotGroup);
      };

      hitMesh.userData.onHover = () => {
        // Subtle, elegant 5% elevation (Vision Pro standard, not 15%+)
        hotspotGroup.userData.targetScale = 1.05;
        hotspotGroup.userData.targetOpacity = 1.0;
        hotspotGroup.userData.targetCardOpacity = 1.0;
      };

      hitMesh.userData.onHoverEnd = () => {
        hotspotGroup.userData.targetScale = 1.0;
        hotspotGroup.userData.targetOpacity = 0.95;
        hotspotGroup.userData.targetCardOpacity = 0.0;
      };

      // Initially hidden until video playback reaches timeStart
      hotspotGroup.visible = false;

      this.parentGroup.add(hotspotGroup);
      this.hotspots.push({
        group: hotspotGroup,
        data: data,
        billboardMesh: billboardGroup,
        orbMaterial: orbMat,
        cardMaterial: cardMat,
        hitMesh: hitMesh
      });
      this.interactiveMeshes.push(hitMesh);
    });
  }

  sphericalToCartesian(yawDeg, pitchDeg, radius = 3.8) {
    const phi = THREE.MathUtils.degToRad(90 - pitchDeg);
    const theta = THREE.MathUtils.degToRad(yawDeg + 90);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi) + 1.6;
    const z = -radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  triggerActivation(hotspotGroup) {
    const data = hotspotGroup.userData.data;
    if (this.onSelectHotspot) {
      this.onSelectHotspot(data);
    }
  }

  syncWithTime(currentTime) {
    this.hotspots.forEach(({ group, data }) => {
      const isActive = currentTime >= data.timeStart && currentTime <= data.timeEnd;
      group.visible = isActive;
    });
  }

  getInteractiveMeshes() {
    return this.interactiveMeshes;
  }

  /**
   * Fluid Apple Vision Pro OS Inspired Physics Update:
   * 1. Continuous camera-facing billboarding (always perfectly aligned to eyes)
   * 2. Rock-steady geometry: NO constant resizing, strobing, or mechanical wobbling
   * 3. Organic 4.5s luminous breathing on opacity (ambient LED effect, not geometry scale)
   * 4. Damped Harmonic Spring Physics for gaze/hover elevation
   */
  update(delta, time) {
    if (!this.camera) return;

    // Very gentle ambient luminosity modulation (4.5 second smooth cycle, +/- 3% opacity)
    const ambientLuminance = Math.sin(time * 1.4) * 0.03;

    // visionOS Spring Constants (snappy yet smooth)
    const springStiffness = 180;
    const springDamping = 16;
    const clampedDelta = Math.min(delta, 0.05);

    this.hotspots.forEach(({ group, orbMaterial, cardMaterial }) => {
      if (group.visible) {
        // 1. Precise Camera Billboarding
        group.quaternion.copy(this.camera.quaternion);

        // 2. Damped Spring Physics for Hover Elevation
        const currentScale = group.userData.currentScale || 1.0;
        const targetScale = group.userData.targetScale || 1.0;
        let vel = group.userData.velocity || 0;

        const force = (targetScale - currentScale) * springStiffness;
        vel += force * clampedDelta;
        vel *= Math.max(0, 1 - springDamping * clampedDelta);
        const newScale = currentScale + vel * clampedDelta;

        group.userData.currentScale = newScale;
        group.userData.velocity = vel;
        group.scale.set(newScale, newScale, newScale);

        // 3. Smooth Opacity Modulation (Organic light glow instead of size throb)
        const baseOpacity = group.userData.targetOpacity || 0.95;
        orbMaterial.opacity = Math.max(0.88, Math.min(1.0, baseOpacity + ambientLuminance));
        
        // 4. Smoothly animate Card reveal on hover
        const targetCardOpacity = group.userData.targetCardOpacity || 0.0;
        cardMaterial.opacity += (targetCardOpacity - cardMaterial.opacity) * 12 * clampedDelta;
      }
    });
  }
}

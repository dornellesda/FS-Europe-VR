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

    // Spatial presence: a hotspot stays anchored to its world position and
    // fades out as the viewer turns away from it (view cone) or moves away
    // from it / walks into it (distance). Time in/out (syncWithTime) still
    // gates the window; this governs in-view visibility on top.
    this.spatial = {
      viewFullDeg: 38,      // fully visible within ±38° of the camera axis
      viewHiddenDeg: 55,    // fully hidden past ±55° (leaves the ~54° screen edge)
      minDistFull: 1.6,     // fully visible at ≥1.6 m from the anchor
      minDistHidden: 1.0,   // fully hidden closer than 1.0 m (user walked into it)
      maxDistFull: 6.2,     // fully visible up to 6.2 m away
      maxDistHidden: 8.5,   // fully hidden beyond 8.5 m
      interactionThreshold: 0.15 // below this spatial factor, no click/hover
    };

    // Scratch vectors reused every frame — no per-frame allocations.
    this._vCamPos = new THREE.Vector3();
    this._vCamDir = new THREE.Vector3();
    this._vToHotspot = new THREE.Vector3();

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
          iconType: 'exhibit',
          badgeText: '3D ARTIFACT',
          actionText: 'Tap to Inspect Replica',
          accent: '#87b940',
          accentRgb: '135, 185, 64'
        };
      case 'video-popup':
        return {
          iconType: 'video',
          badgeText: 'CURATOR SPOTLIGHT',
          actionText: 'Tap to Watch Video',
          accent: '#fbbf24',
          accentRgb: '251, 191, 36'
        };
      case 'qr-code':
      default:
        return {
          iconType: 'qr',
          badgeText: 'DIGITAL CATALOG',
          actionText: 'Tap to Open Web Link & QR',
          accent: '#34d399',
          accentRgb: '52, 211, 153'
        };
    }
  }

  /**
   * Flat, premium hotspot marker inspired by the rest of the interface:
   * a slim tonal icon ring with a flat stroke glyph, plus a soft label pill
   * (matching HUD badge styling) and a minimal title panel on hover.
   */
  createVisionGlassTexture(data) {
    const theme = this.getTypeTheme(data.type);
    const accent = theme.accent;
    const rgb = theme.accentRgb;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // -------------------------------------------------------------
    // 1. FLAT ICON CHIP (lens ring + tonal disc + flat glyph) — large,
    //    self-contained marker with no stem to the hover card.
    // -------------------------------------------------------------
    const cx = 512;
    const cy = 112;
    const R = 74;

    // Soft distant halo ring
    ctx.strokeStyle = `rgba(${rgb}, 0.18)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 24, 0, Math.PI * 2);
    ctx.stroke();

    // Flat tonal disc
    const disc = ctx.createRadialGradient(cx - 20, cy - 22, 4, cx, cy, R);
    disc.addColorStop(0, `rgba(${rgb}, 0.30)`);
    disc.addColorStop(1, `rgba(${rgb}, 0.07)`);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Crisp primary ring
    ctx.strokeStyle = `rgba(${rgb}, 0.85)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Slim inner accent ring
    ctx.strokeStyle = `rgba(${rgb}, 0.35)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 11, 0, Math.PI * 2);
    ctx.stroke();

    // Flat stroke glyph (scaled to match the larger chip)
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.drawFlatIcon(ctx, theme.iconType, cx, cy, 1.45);

    // -------------------------------------------------------------
    // 2. FLAT LABEL PILL (HUD badge style)
    // -------------------------------------------------------------
    const pillY = 252;
    const pillH = 52;
    ctx.font = '700 26px Inter, sans-serif';
    const textW = ctx.measureText(theme.badgeText).width;
    const pillW = textW + 54;
    const pillX = cx - pillW / 2;

    ctx.fillStyle = `rgba(${rgb}, 0.12)`;
    this.drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb}, 0.4)`;
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.stroke();

    // Cue dot (like the HUD active-cue-pill)
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(pillX + 24, pillY + pillH / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Spaced uppercase label
    ctx.fillStyle = accent;
    ctx.font = '700 26px Inter, sans-serif';
    this.drawSpacedText(ctx, theme.badgeText, pillX + 40, pillY + pillH / 2, 3);

    // -------------------------------------------------------------
    // 3. FLAT TITLE PANEL (revealed on hover)
    // -------------------------------------------------------------
    const cardX = 82;
    const cardY = 328;
    const cardW = 860;
    const cardH = 212;
    const cardR = 24;

    ctx.fillStyle = 'rgba(13, 20, 38, 0.62)';
    this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.stroke();

    // Accent hairline (mirrors the video popup card top hairline)
    ctx.strokeStyle = `rgba(${rgb}, 0.7)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cardX + 34, cardY + 2);
    ctx.lineTo(cardX + 176, cardY + 2);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 33px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const title = data.title.length > 28 ? data.title.substring(0, 26) + '...' : data.title;
    ctx.fillText(title, cardX + 34, cardY + 62);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 26px Inter, sans-serif';
    const sub = (data.subtitle || 'Tap to explore').substring(0, 46);
    ctx.fillText(sub, cardX + 34, cardY + 116);

    ctx.fillStyle = accent;
    ctx.font = '600 21px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${theme.actionText}  →`, cardX + cardW - 34, cardY + 166);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  drawFlatIcon(ctx, type, cx, cy, scale = 1) {
    if (type === 'exhibit') {
      const arm = 24 * scale;
      ctx.beginPath();
      ctx.moveTo(cx, cy - arm);
      ctx.lineTo(cx + arm, cy);
      ctx.lineTo(cx, cy + arm);
      ctx.lineTo(cx - arm, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - arm * 0.5, cy);
      ctx.lineTo(cx + arm * 0.5, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'video') {
      const rad = 26 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 9 * scale, cy - 13 * scale);
      ctx.lineTo(cx - 9 * scale, cy + 13 * scale);
      ctx.lineTo(cx + 15 * scale, cy);
      ctx.closePath();
      ctx.fill();
    } else {
      const s = 26 * scale;
      this.drawRoundedRect(ctx, cx - s, cy - s, s * 2, s * 2, 8 * scale);
      ctx.stroke();
      ctx.fillRect(cx - s, cy - s, 9 * scale, 9 * scale);
      ctx.fillRect(cx + s - 9 * scale, cy - s, 9 * scale, 9 * scale);
      ctx.fillRect(cx - s, cy + s - 9 * scale, 9 * scale, 9 * scale);
    }
  }

  drawSpacedText(ctx, text, x, y, spacing) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cursor = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + spacing;
    }
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
      hotspotGroup.userData.spatialFactorSmooth = 1.0;
      hotspotGroup.userData.spatialFactor = 1.0;
      hotspotGroup.userData.spatialCfg = this._spatialConfig(data);

      // Convert spherical angles to 3D Cartesian coordinates
      const pos = this.sphericalToCartesian(data.yaw, data.pitch, data.distance || 3.8);
      hotspotGroup.position.copy(pos);

      // Single unified flat chip texture plane, split into Chip and Card (hover reveal)
      const texture = this.createVisionGlassTexture(data);
      const aspect = 1024 / 640;
      const planeHeight = 1.1;
      const planeWidth = planeHeight * aspect; // ~1.76m

      const topRatio = 248 / 640;
      const bottomRatio = 392 / 640;
      
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
      // Scaled to match the compact chip-size marker
      const hitGeom = new THREE.SphereGeometry(0.55, 16, 16);
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

  /**
   * Per-hotspot spatial tuning. Defaults match the shared `this.spatial`
   * presets; an admin can override any value through hotspot data, e.g.
   * { spatial: { enabled: false } } to keep one always available, or
   * { spatial: { viewFullDeg: 20, viewHiddenDeg: 40 } } for a tighter cone.
   */
  _spatialConfig(data) {
    const s = (data && data.spatial) || {};
    return {
      enabled: s.enabled !== false,
      fullConeDeg: s.fullConeDeg ?? this.spatial.viewFullDeg,
      hideConeDeg: s.hideConeDeg ?? this.spatial.viewHiddenDeg,
      minFullDist: s.minFullDist ?? this.spatial.minDistFull,
      minHideDist: s.minHideDist ?? this.spatial.minDistHidden,
      maxFullDist: s.maxFullDist ?? this.spatial.maxDistFull,
      maxHideDist: s.maxHideDist ?? this.spatial.maxDistHidden
    };
  }

  /**
   * 0..1 how present the hotspot is right now: 1 = dead ahead at a healthy
   * distance, 0 = fully culled. Combines the view-cone (angular) check with
   * a distance check so the marker truly sticks to its spot and vanishes
   * when the viewer turns away or moves out of range.
   */
  _computeSpatialFactor(position, cfg) {
    if (cfg.enabled === false) return 1;

    this._vToHotspot.subVectors(position, this._vCamPos);
    const dist = this._vToHotspot.length();
    this._vToHotspot.normalize();

    // Angular culling: how far the hotspot sits from the camera's view axis.
    const cosAngle = this._vCamDir.dot(this._vToHotspot);
    const angleDeg = THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, cosAngle))));
    let angleFactor = 1;
    if (angleDeg >= cfg.hideConeDeg) {
      angleFactor = 0;
    } else if (angleDeg > cfg.fullConeDeg) {
      angleFactor = 1 - (angleDeg - cfg.fullConeDeg) / (cfg.hideConeDeg - cfg.fullConeDeg);
    }

    // Distance culling: fade when the viewer walks in or wanders far off
    // (relevant in VR room-scale; desktop keeps a constant 3.8 m radius).
    let distFactor = 1;
    if (dist <= cfg.minHideDist || dist >= cfg.maxHideDist) {
      distFactor = 0;
    } else if (dist < cfg.minFullDist) {
      distFactor = (dist - cfg.minHideDist) / (cfg.minFullDist - cfg.minHideDist);
    } else if (dist > cfg.maxFullDist) {
      distFactor = 1 - (dist - cfg.maxFullDist) / (cfg.maxHideDist - cfg.maxFullDist);
    }

    return Math.max(0, Math.min(1, Math.min(angleFactor, distFactor)));
  }

  /**
   * Rotates all hotspot anchor positions around the vertical (Y) axis.
   * Used in VR to bring startPOV into the user's initial view.
   * Billboarding is untouched (groups still track the camera), so the
   * markers keep facing the user. Passing 0 restores the authored layout.
   */
  applyWorldRotationY(yawDeg = 0) {
    const rad = THREE.MathUtils.degToRad(-yawDeg);
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    this.hotspots.forEach(({ group, data }) => {
      const base = this.sphericalToCartesian(data.yaw, data.pitch, data.distance || 3.8);
      group.position.set(
        base.x * cosA + base.z * sinA,
        base.y,
        -base.x * sinA + base.z * cosA
      );
    });
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

    // Camera pose for spatial culling (desktop orbit + VR headset alike)
    this.camera.getWorldPosition(this._vCamPos);
    this.camera.getWorldDirection(this._vCamDir);

    this.hotspots.forEach(({ group, orbMaterial, cardMaterial, hitMesh, data }) => {
      if (!group.visible) {
        // Outside its time in/out window — fully hidden and not interactive.
        hitMesh.visible = false;
        orbMaterial.opacity = 0;
        cardMaterial.opacity = 0;
        return;
      }

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

      // 3. Spatial presence — fade out as the viewer turns away or moves
      //    away, so the marker sticks to its spot instead of following the
      //    camera around. Smoothly lerped to avoid popping.
      const factor = this._computeSpatialFactor(group.position, group.userData.spatialCfg);
      const smooth = group.userData.spatialFactorSmooth || 1.0;
      const newSmooth = smooth + (factor - smooth) * Math.min(1, 10 * clampedDelta);
      group.userData.spatialFactorSmooth = newSmooth;
      group.userData.spatialFactor = newSmooth;

      // Culled hotspots drop out of raycasting entirely.
      hitMesh.visible = newSmooth > this.spatial.interactionThreshold;

      // 4. Smooth Opacity Modulation (Organic light glow instead of size throb)
      const baseOpacity = group.userData.targetOpacity || 0.95;
      const visibleOpacity = Math.max(0.88, Math.min(1.0, baseOpacity + ambientLuminance));
      orbMaterial.opacity = visibleOpacity * newSmooth;

      // 5. Smoothly animate Card reveal on hover (scaled by spatial factor)
      const targetCardOpacity = (group.userData.targetCardOpacity || 0.0) * newSmooth;
      cardMaterial.opacity += (targetCardOpacity - cardMaterial.opacity) * 12 * clampedDelta;
    });
  }
}

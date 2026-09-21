import * as THREE from 'three';

export class ExhibitModal {
  constructor(scene, camera, xrControllerManager, inputManager, onResumeTour) {
    this.scene = scene;
    this.camera = camera;
    this.xrControllerManager = xrControllerManager;
    this.inputManager = inputManager;
    this.onResumeTour = onResumeTour;

    this.isOpen = false;
    this.modalGroup = new THREE.Group();
    this.scene.add(this.modalGroup);
    this.modalGroup.visible = false;

    this.interactiveMeshes = [];
    this.activeExhibitData = null;
    this.modelGroup = new THREE.Group();
    this.modalGroup.add(this.modelGroup);

    // Audio beep synthesis for interaction feedback
    this.audioCtx = null;

    // Desktop UI Overlay container
    this.domOverlay = document.getElementById('exhibit-modal-overlay');
  }

  playClickSound() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio context may be restricted before interaction
    }
  }

  open(exhibit) {
    this.isOpen = true;
    this.activeExhibitData = exhibit;
    this.playClickSound();

    // Position modal 1.4m in front of current camera look direction
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0; // maintain horizontal pedestal
    camDir.normalize();

    const targetPos = this.camera.position.clone().add(camDir.multiplyScalar(1.5));
    targetPos.y = 1.4; // convenient interaction height in VR

    this.modalGroup.position.copy(targetPos);
    this.modalGroup.lookAt(this.camera.position.x, targetPos.y, this.camera.position.z);
    this.modalGroup.visible = true;

    // Clear previous model & buttons
    this.cleanUp();

    // Build Pedestal & 3D Interactive Model
    this.buildPedestal();
    this.buildExhibitModel(exhibit.exhibitData);

    // Build 3D Floating UI Panels in VR
    this.buildVRUI(exhibit);

    // Show Desktop 2D Overlay
    this.showDesktopOverlay(exhibit);

    // Register interactive buttons with VR controller and desktop raycaster
    this.interactiveMeshes.forEach((mesh) => {
      this.xrControllerManager.addInteractiveObject(mesh);
      this.inputManager.addInteractiveObject(mesh);
    });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.playClickSound();

    this.modalGroup.visible = false;
    this.cleanUp();

    if (this.domOverlay) {
      this.domOverlay.classList.remove('active');
    }

    if (this.onResumeTour) {
      this.onResumeTour();
    }
  }

  cleanUp() {
    this.interactiveMeshes.forEach((mesh) => {
      this.xrControllerManager.removeInteractiveObject(mesh);
      this.inputManager.removeInteractiveObject(mesh);
    });
    this.interactiveMeshes = [];

    while (this.modelGroup.children.length > 0) {
      const obj = this.modelGroup.children[0];
      this.modelGroup.remove(obj);
    }
  }

  buildPedestal() {
    // Pedestal base
    const baseGeom = new THREE.CylinderGeometry(0.55, 0.65, 0.08, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8
    });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.set(0, -0.55, 0);
    this.modelGroup.add(base);

    // Glowing ring on pedestal
    const glowRingGeom = new THREE.TorusGeometry(0.52, 0.015, 16, 48);
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: 0x87b940,
      transparent: true,
      opacity: 0.8
    });
    const glowRing = new THREE.Mesh(glowRingGeom, glowRingMat);
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.set(0, -0.5, 0);
    this.modelGroup.add(glowRing);
  }

  buildExhibitModel(data) {
    if (data.modelType === 'astrolabe') {
      this.buildAstrolabeModel();
    } else {
      this.buildQuantumLevitatorModel();
    }
  }

  buildAstrolabeModel() {
    const group = new THREE.Group();
    group.name = 'interactiveAstrolabe';

    // Outer Brass Ring (Mater)
    const materGeom = new THREE.TorusGeometry(0.42, 0.035, 24, 64);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.25
    });
    this.astrolabeMaterial = brassMat;

    const mater = new THREE.Mesh(materGeom, brassMat);
    group.add(mater);

    // Inner Rotating Rete Rings
    this.astrolabeRings = [];
    const ringRadii = [0.34, 0.25, 0.16];
    ringRadii.forEach((r, idx) => {
      const ringGeom = new THREE.RingGeometry(r - 0.02, r, 48);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xe6ca65,
        metalness: 0.85,
        roughness: 0.3,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.z = 0.01 * (idx + 1);
      group.add(ring);
      this.astrolabeRings.push(ring);
    });

    // Central Star Pointer Needle
    const needleGeom = new THREE.ConeGeometry(0.04, 0.76, 8);
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      metalness: 0.95,
      roughness: 0.2
    });
    const needle = new THREE.Mesh(needleGeom, needleMat);
    needle.position.z = 0.04;
    group.add(needle);
    this.astrolabeNeedle = needle;

    // Center pivot gem
    const gemGeom = new THREE.SphereGeometry(0.05, 16, 16);
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x87b940,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.1
    });
    const gem = new THREE.Mesh(gemGeom, gemMat);
    gem.position.z = 0.05;
    group.add(gem);

    group.position.set(0, 0.1, 0);
    this.modelGroup.add(group);
    this.currentExhibitObject = group;
  }

  buildQuantumLevitatorModel() {
    const group = new THREE.Group();
    group.name = 'interactiveQuantum';

    // Base Superconductor plate
    const plateGeom = new THREE.CylinderGeometry(0.42, 0.45, 0.06, 32);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2
    });
    const plate = new THREE.Mesh(plateGeom, plateMat);
    plate.position.set(0, -0.2, 0);
    group.add(plate);

    // Glowing Magnetic Track Torus
    const toroidGeom = new THREE.TorusGeometry(0.35, 0.02, 16, 64);
    const toroidMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.9
    });
    const toroid = new THREE.Mesh(toroidGeom, toroidMat);
    toroid.rotation.x = Math.PI / 2;
    toroid.position.set(0, -0.15, 0);
    group.add(toroid);

    // Levitating Crystal / Cube
    const cubeGeom = new THREE.OctahedronGeometry(0.2, 1);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0891b2,
      emissiveIntensity: 0.8,
      metalness: 0.95,
      roughness: 0.1,
      wireframe: false
    });
    const cube = new THREE.Mesh(cubeGeom, cubeMat);
    cube.position.set(0, 0.18, 0);
    group.add(cube);
    this.quantumCube = cube;

    // Surrounding orbital flux rings
    this.quantumRings = [];
    for (let i = 0; i < 3; i++) {
      const ringGeom = new THREE.TorusGeometry(0.28 + i * 0.06, 0.008, 12, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x87b940,
        transparent: true,
        opacity: 0.75
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(0, 0.18, 0);
      ring.rotation.x = (Math.PI / 4) * (i + 1);
      ring.rotation.y = (Math.PI / 6) * i;
      group.add(ring);
      this.quantumRings.push(ring);
    }

    this.modelGroup.add(group);
    this.currentExhibitObject = group;
  }

  buildVRUI(exhibit) {
    const data = exhibit.exhibitData;

    // Floating Header Banner in 3D
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 360;
    const ctx = bannerCanvas.getContext('2d');

    // Background Card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    this.roundRect(ctx, 10, 10, 1004, 340, 28);
    ctx.fill();

    ctx.strokeStyle = '#87b940';
    ctx.lineWidth = 4;
    this.roundRect(ctx, 10, 10, 1004, 340, 28);
    ctx.stroke();

    // Category
    ctx.fillStyle = '#87b940';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(data.category.toUpperCase(), 45, 65);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(data.title, 45, 125);

    // Description text wrapped
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '24px system-ui, sans-serif';
    this.wrapText(ctx, data.description, 45, 175, 910, 36);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true, side: THREE.DoubleSide });
    const bannerGeom = new THREE.PlaneGeometry(1.2, 0.42);
    const bannerMesh = new THREE.Mesh(bannerGeom, bannerMat);
    bannerMesh.position.set(0, 0.85, 0);
    this.modelGroup.add(bannerMesh);

    // 3D Interactive Action Buttons
    const features = data.features || [];
    features.forEach((feat, index) => {
      const btnX = (index - (features.length - 1) / 2) * 0.42;
      const btnMesh = this.createVRButton(feat.label, 0x0284c7, () => {
        this.handleFeatureAction(feat.action);
      });
      btnMesh.position.set(btnX, -0.32, 0.25);
      btnMesh.rotation.x = -Math.PI / 8;
      this.modelGroup.add(btnMesh);
    });

    // "Return to Tour Guide" Close Button
    const closeBtn = this.createVRButton('⬅ Return to Tour Guide', 0x10b981, () => {
      this.close();
    });
    closeBtn.position.set(0, -0.48, 0.32);
    closeBtn.rotation.x = -Math.PI / 8;
    this.modelGroup.add(closeBtn);
  }

  createVRButton(label, colorHex, onClick) {
    const group = new THREE.Group();

    // 3D Rounded Box / Bevel button
    const boxGeom = new THREE.BoxGeometry(0.38, 0.1, 0.04);
    const boxMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.3,
      metalness: 0.5
    });
    const box = new THREE.Mesh(boxGeom, boxMat);
    group.add(box);

    // Text Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 135;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 68);

    const tex = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const textGeom = new THREE.PlaneGeometry(0.36, 0.095);
    const textMesh = new THREE.Mesh(textGeom, textMat);
    textMesh.position.set(0, 0, 0.022);
    group.add(textMesh);

    // Hitbox for raycasting
    box.userData.onClick = () => {
      this.playClickSound();
      onClick();
    };
    box.userData.onHover = () => {
      boxMat.color.setHex(0x87b940);
      group.scale.set(1.08, 1.08, 1.08);
    };
    box.userData.onHoverEnd = () => {
      boxMat.color.setHex(colorHex);
      group.scale.set(1, 1, 1);
    };

    this.interactiveMeshes.push(box);
    return group;
  }

  handleFeatureAction(action) {
    this.playClickSound();
    if (action === 'spin') {
      this.spinSpeed = (this.spinSpeed || 1) * -1.8;
    } else if (action === 'stars') {
      if (this.astrolabeNeedle) {
        this.astrolabeNeedle.rotation.z += Math.PI / 4;
      }
    } else if (action === 'material') {
      if (this.astrolabeMaterial) {
        const colors = [0xd4af37, 0xfacc15, 0xe2e8f0, 0xf97316];
        const nextColor = colors[Math.floor(Math.random() * colors.length)];
        this.astrolabeMaterial.color.setHex(nextColor);
      }
    } else if (action === 'levitate') {
      this.levitationOffset = (this.levitationOffset || 0) + 0.15;
      if (this.levitationOffset > 0.4) this.levitationOffset = 0;
    } else if (action === 'cool') {
      if (this.quantumCube) {
        this.quantumCube.material.color.setHex(0xa5f3fc);
        this.quantumCube.material.emissiveIntensity = 1.5;
      }
    } else if (action === 'pulse') {
      this.pulseBoost = 2.5;
    }
  }

  showDesktopOverlay(exhibit) {
    if (!this.domOverlay) return;
    const data = exhibit.exhibitData;

    let featureButtonsHtml = '';
    (data.features || []).forEach((feat) => {
      featureButtonsHtml += `
        <button class="modal-feature-btn" data-action="${feat.action}">
          <span>✦</span> ${feat.label}
        </button>
      `;
    });

    this.domOverlay.innerHTML = `
      <div class="exhibit-card">
        <div class="card-header">
          <div class="card-badge">${data.category}</div>
          <button class="close-overlay-btn" id="close-exhibit-btn">✕ Return to Tour</button>
        </div>
        <h2>${data.title}</h2>
        <p class="card-description">${data.description}</p>
        <div class="card-instructions">
          <span>💡 In VR: Touch buttons with your controller laser. On Desktop: Use mouse drag to examine.</span>
        </div>
        <div class="feature-buttons-row">
          ${featureButtonsHtml}
        </div>
      </div>
    `;

    this.domOverlay.classList.add('active');

    // Bind DOM button events
    const closeBtn = document.getElementById('close-exhibit-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const buttons = this.domOverlay.querySelectorAll('.modal-feature-btn');
    buttons.forEach((btn) => {
      btn.onclick = () => {
        const action = btn.getAttribute('data-action');
        this.handleFeatureAction(action);
      };
    });
  }

  roundRect(ctx, x, y, width, height, radius) {
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

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  update(delta, time) {
    if (!this.isOpen) return;

    // Animate Astrolabe gears
    if (this.astrolabeRings && this.astrolabeRings.length > 0) {
      const speed = (this.spinSpeed || 1) * delta;
      this.astrolabeRings[0].rotation.z += speed * 0.8;
      this.astrolabeRings[1].rotation.z -= speed * 1.2;
      this.astrolabeRings[2].rotation.z += speed * 1.5;
    }

    // Animate Quantum Levitator
    if (this.quantumCube) {
      const hoverY = 0.18 + Math.sin(time * 3) * 0.05 + (this.levitationOffset || 0);
      this.quantumCube.position.y = hoverY;
      this.quantumCube.rotation.x += delta * 0.8;
      this.quantumCube.rotation.y += delta * 1.2;

      this.quantumRings.forEach((ring, idx) => {
        ring.position.y = hoverY;
        ring.rotation.z += delta * (1 + idx * 0.5);
      });

      if (this.pulseBoost && this.pulseBoost > 0) {
        this.pulseBoost -= delta * 2;
        this.quantumCube.scale.setScalar(1 + this.pulseBoost * 0.1);
      }
    }
  }
}

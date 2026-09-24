import * as THREE from 'three';
import { generateQRCanvas } from '../utils/qrGenerator.js';

export class QRCodeLinkModal {
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
    this.activeQRData = null;

    // Desktop UI container
    this.domOverlay = document.getElementById('qr-modal-overlay');
  }

  open(hotspot) {
    this.isOpen = true;
    this.activeQRData = hotspot.qrData;

    // Position modal 1.4m in front of camera
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    const targetPos = this.camera.position.clone().add(camDir.multiplyScalar(1.5));
    targetPos.y = 1.4;

    this.modalGroup.position.copy(targetPos);
    this.modalGroup.lookAt(this.camera.position.x, targetPos.y, this.camera.position.z);
    this.modalGroup.visible = true;

    this.cleanUp();
    this.buildVRCard(hotspot);
    this.showDesktopOverlay(hotspot);

    this.interactiveMeshes.forEach((mesh) => {
      this.xrControllerManager.addInteractiveObject(mesh);
      this.inputManager.addInteractiveObject(mesh);
    });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
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

    while (this.modalGroup.children.length > 0) {
      const obj = this.modalGroup.children[0];
      this.modalGroup.remove(obj);
    }
  }

  buildVRCard(hotspot) {
    const qrData = hotspot.qrData;

    // Background Card
    const cardGeom = new THREE.PlaneGeometry(1.3, 0.9);
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.3,
      metalness: 0.7
    });
    const card = new THREE.Mesh(cardGeom, cardMat);
    this.modalGroup.add(card);

    // Glowing border frame
    const borderGeom = new THREE.EdgesGeometry(cardGeom);
    const borderMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const border = new THREE.LineSegments(borderGeom, borderMat);
    this.modalGroup.add(border);

    // Generate QR Canvas texture
    const qrCanvas = generateQRCanvas(qrData.url, 320);
    const qrTexture = new THREE.CanvasTexture(qrCanvas);
    const qrGeom = new THREE.PlaneGeometry(0.38, 0.38);
    const qrMat = new THREE.MeshBasicMaterial({ map: qrTexture });
    const qrMesh = new THREE.Mesh(qrGeom, qrMat);
    qrMesh.position.set(-0.35, 0.12, 0.02);
    this.modalGroup.add(qrMesh);

    // White padding frame around QR
    const qrBorderGeom = new THREE.PlaneGeometry(0.42, 0.42);
    const qrBorderMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const qrBorder = new THREE.Mesh(qrBorderGeom, qrBorderMat);
    qrBorder.position.set(-0.35, 0.12, 0.01);
    this.modalGroup.add(qrBorder);

    // Text Details Canvas
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 640;
    textCanvas.height = 420;
    const ctx = textCanvas.getContext('2d');

    // Badge
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('⛶ SCANNED QR CODE LINK', 20, 45);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(qrData.title, 20, 100);

    // URL preview pill
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    this.roundRect(ctx, 20, 120, 580, 50, 12);
    ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`🔗 ${qrData.displayUrl || qrData.url}`, 35, 153);

    // Description wrapped
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px system-ui, sans-serif';
    this.wrapText(ctx, qrData.description, 20, 210, 580, 32);

    const textTex = new THREE.CanvasTexture(textCanvas);
    const textMat = new THREE.MeshBasicMaterial({ map: textTex, transparent: true });
    const textGeom = new THREE.PlaneGeometry(0.68, 0.44);
    const textMesh = new THREE.Mesh(textGeom, textMat);
    textMesh.position.set(0.24, 0.12, 0.02);
    this.modalGroup.add(textMesh);

    // 3D VR Button: Open Link
    const openBtn = this.createVRButton('↗ Open Link in Browser', 0x059669, () => {
      this.handleOpenLink(qrData.url);
    });
    openBtn.position.set(-0.25, -0.3, 0.04);
    this.modalGroup.add(openBtn);

    // 3D VR Button: Return to Tour
    const closeBtn = this.createVRButton('✕ Return to Tour', 0x334155, () => {
      this.close();
    });
    closeBtn.position.set(0.25, -0.3, 0.04);
    this.modalGroup.add(closeBtn);
  }

  createVRButton(label, colorHex, onClick) {
    const group = new THREE.Group();

    const boxGeom = new THREE.BoxGeometry(0.42, 0.1, 0.03);
    const boxMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.3,
      metalness: 0.6
    });
    const box = new THREE.Mesh(boxGeom, boxMat);
    group.add(box);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 135;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 68);

    const tex = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const textGeom = new THREE.PlaneGeometry(0.4, 0.095);
    const textMesh = new THREE.Mesh(textGeom, textMat);
    textMesh.position.set(0, 0, 0.02);
    group.add(textMesh);

    box.userData.onClick = onClick;
    box.userData.onHover = () => {
      boxMat.color.setHex(0x10b981);
      group.scale.set(1.08, 1.08, 1.08);
    };
    box.userData.onHoverEnd = () => {
      boxMat.color.setHex(colorHex);
      group.scale.set(1, 1, 1);
    };

    this.interactiveMeshes.push(box);
    return group;
  }

  handleOpenLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  showDesktopOverlay(hotspot) {
    if (!this.domOverlay) return;
    const qrData = hotspot.qrData;

    this.domOverlay.innerHTML = `
      <div class="qr-card">
        <span class="spot-hairline" aria-hidden="true"></span>
        <header class="spot-head">
          <span class="spot-badge">
            <span class="spot-badge-dot"></span>
            <span>Digital Catalog Link</span>
          </span>
          <button class="spot-close" id="close-qr-btn" title="Return to Tour" aria-label="Close QR link">✕</button>
        </header>
        <div class="qr-body">
          <div class="qr-canvas-holder" id="qr-holder"></div>
          <div class="qr-info">
            <span class="spot-eyebrow">Scan or tap to open</span>
            <h2 class="spot-title">${qrData.title}</h2>
            <p class="spot-desc">${qrData.description}</p>
            <div class="qr-url-box">
              <span class="qr-url-ico">🔗</span>
              <code>${qrData.displayUrl || qrData.url}</code>
            </div>
            <div class="qr-actions">
              <a href="${qrData.url}" target="_blank" rel="noopener noreferrer" class="spot-btn spot-btn-primary">
                ↗ Open Website
              </a>
              <button class="spot-btn spot-btn-ghost" id="copy-qr-url-btn">📋 Copy Link</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Embed QR Canvas in DOM holder
    const holder = document.getElementById('qr-holder');
    if (holder) {
      const canvas = generateQRCanvas(qrData.url, 220);
      holder.appendChild(canvas);
    }

    this.domOverlay.classList.add('active');

    const closeBtn = document.getElementById('close-qr-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const copyBtn = document.getElementById('copy-qr-url-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(qrData.url);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Link';
        }, 2500);
      };
    }
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
}

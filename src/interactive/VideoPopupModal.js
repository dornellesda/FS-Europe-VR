import * as THREE from 'three';

export class VideoPopupModal {
  constructor(scene, camera, xrControllerManager, inputManager, onResumeTour) {
    this.scene = scene;
    this.camera = camera;
    this.xrControllerManager = xrControllerManager;
    this.inputManager = inputManager;
    this.onResumeTour = onResumeTour;

    this.isOpen = false;
    this.activeData = null;
    this.modalGroup = new THREE.Group();
    this.scene.add(this.modalGroup);
    this.modalGroup.visible = false;

    this.interactiveMeshes = [];
    this.videoElement = null;
    this.videoTexture = null;
    this.screenMesh = null;

    // Desktop modal overlay
    this.domOverlay = document.getElementById('video-popup-modal-overlay');
    if (!this.domOverlay) {
      this.domOverlay = document.createElement('div');
      this.domOverlay.id = 'video-popup-modal-overlay';
      this.domOverlay.className = 'modal-overlay';
      document.body.appendChild(this.domOverlay);
    }

    this.setupDesktopDOM();
  }

  setupDesktopDOM() {
    this.domOverlay.innerHTML = `
      <div class="modal-card video-popup-card">
        <div class="modal-header">
          <div class="modal-badge video-badge">
            <span class="badge-icon">🎬</span>
            <span>EXHIBIT VIDEO SPOTLIGHT</span>
          </div>
          <button class="modal-close-btn" id="btn-close-video-popup" title="Close Video (Esc)">✕</button>
        </div>

        <div class="video-player-container">
          <video id="dom-popup-video" playsinline controls class="popup-video-element"></video>
        </div>

        <div class="modal-info-panel">
          <h2 class="modal-title" id="video-popup-title">Curator Commentary</h2>
          <p class="modal-desc" id="video-popup-desc">Video details and archive footage.</p>
        </div>
      </div>
    `;

    this.domVideo = document.getElementById('dom-popup-video');
    document.getElementById('btn-close-video-popup')?.addEventListener('click', () => {
      this.close();
    });

    this.domOverlay.addEventListener('click', (e) => {
      if (e.target === this.domOverlay) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open(hotspot) {
    this.isOpen = true;
    this.activeData = hotspot;
    const videoData = hotspot.videoData || {};

    // 1. Position 3D Group in front of current camera
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    const targetPos = this.camera.position.clone().add(camDir.multiplyScalar(1.6));
    targetPos.y = 1.5;

    this.modalGroup.position.copy(targetPos);
    this.modalGroup.lookAt(this.camera.position.x, targetPos.y, this.camera.position.z);
    this.modalGroup.visible = true;

    // Clean up previous 3D objects
    this.cleanUp3D();

    // 2. Build 3D VR Floating Screen
    this.build3DVideoScreen(videoData);

    // 3. Show Desktop Overlay with HTML5 Video
    this.showDesktopOverlay(videoData);

    // 4. Register 3D buttons with raycasters
    this.interactiveMeshes.forEach((mesh) => {
      this.xrControllerManager.addInteractiveObject(mesh);
      this.inputManager.addInteractiveObject(mesh);
    });
  }

  build3DVideoScreen(videoData) {
    // Create HTML video element for WebGL VideoTexture
    this.videoElement = document.createElement('video');
    this.videoElement.crossOrigin = 'anonymous';
    this.videoElement.playsInline = true;
    this.videoElement.src = videoData.sourceUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    this.videoElement.autoplay = true;
    this.videoElement.loop = true;
    this.videoElement.muted = false; // VR user triggered interaction so sound is permitted

    this.videoTexture = new THREE.VideoTexture(this.videoElement);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    // 16:9 Screen Geometry (1.2m x 0.675m)
    const screenGeo = new THREE.PlaneGeometry(1.2, 0.675);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      side: THREE.FrontSide
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 0, 0);
    this.modalGroup.add(this.screenMesh);

    // Outer Bezel / Frame
    const frameGeo = new THREE.BoxGeometry(1.26, 0.735, 0.04);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(0, 0, -0.025);
    this.modalGroup.add(frameMesh);

    // Floating Title Panel below video in VR
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024;
    labelCanvas.height = 256;
    const ctx = labelCanvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.roundRect(0, 0, 1024, 256, 32);
    ctx.fill();
    ctx.strokeStyle = '#87b940';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.font = 'bold 44px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(videoData.title || this.activeData.title || 'Video Spotlight', 48, 80);

    ctx.font = '30px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(videoData.caption || this.activeData.subtitle || 'Click Close to return to tour', 48, 140);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(1.2, 0.3);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, -0.55, 0);
    this.modalGroup.add(labelMesh);

    // 3D Close Button in VR
    const btnGeo = new THREE.BoxGeometry(0.24, 0.08, 0.04);
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.5
    });
    const closeBtn = new THREE.Mesh(btnGeo, btnMat);
    closeBtn.position.set(0.48, 0.44, 0.02);
    closeBtn.userData = {
      isInteractive: true,
      onClick: () => this.close(),
      onHover: (hovered) => {
        closeBtn.material.color.setHex(hovered ? 0xdc2626 : 0xef4444);
      }
    };
    this.modalGroup.add(closeBtn);
    this.interactiveMeshes.push(closeBtn);

    // Close label
    const closeCanvas = document.createElement('canvas');
    closeCanvas.width = 256;
    closeCanvas.height = 128;
    const cCtx = closeCanvas.getContext('2d');
    cCtx.fillStyle = '#ffffff';
    cCtx.font = 'bold 48px sans-serif';
    cCtx.textAlign = 'center';
    cCtx.textBaseline = 'middle';
    cCtx.fillText('✕ Close', 128, 64);
    const closeTex = new THREE.CanvasTexture(closeCanvas);
    const closeTextPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.07),
      new THREE.MeshBasicMaterial({ map: closeTex, transparent: true })
    );
    closeTextPlane.position.set(0.48, 0.44, 0.045);
    this.modalGroup.add(closeTextPlane);

    this.videoElement.play().catch(() => {});
  }

  showDesktopOverlay(videoData) {
    if (!this.domOverlay) return;

    document.getElementById('video-popup-title').textContent =
      videoData.title || this.activeData.title || 'Video Spotlight';
    document.getElementById('video-popup-desc').textContent =
      videoData.caption || this.activeData.subtitle || '';

    if (this.domVideo) {
      this.domVideo.src = videoData.sourceUrl || '';
      this.domVideo.play().catch(() => {});
    }

    this.domOverlay.classList.add('active');
  }

  cleanUp3D() {
    this.interactiveMeshes.forEach((mesh) => {
      this.xrControllerManager.removeInteractiveObject(mesh);
      this.inputManager.removeInteractiveObject(mesh);
    });
    this.interactiveMeshes = [];

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
      this.videoElement = null;
    }

    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }

    while (this.modalGroup.children.length > 0) {
      const child = this.modalGroup.children[0];
      this.modalGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.modalGroup.visible = false;
    this.cleanUp3D();

    if (this.domVideo) {
      this.domVideo.pause();
      this.domVideo.src = '';
    }

    if (this.domOverlay) {
      this.domOverlay.classList.remove('active');
    }

    if (this.onResumeTour) {
      this.onResumeTour();
    }
  }

  update() {
    // VideoTexture updates automatically when playing
  }
}

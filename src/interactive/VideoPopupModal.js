import * as THREE from 'three';

const ICON_PLAY = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
const ICON_BACK_10 = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12.5 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16.3" text-anchor="middle" font-size="7.2" font-weight="800" font-family="Arial, Helvetica, sans-serif">10</text></svg>`;
const ICON_FORWARD_10 = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12.5 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="16.3" text-anchor="middle" font-size="7.2" font-weight="800" font-family="Arial, Helvetica, sans-serif">10</text></svg>`;
const ICON_VOL_HIGH = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const ICON_VOL_MUTE = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
const ICON_FULLSCREEN = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;

// A <video> element cannot play YouTube/Vimeo page URLs (they never serve a
// direct MP4). Detect those and route to the embed player instead.
function detectEmbed(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)*v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) {
    return {
      kind: 'youtube',
      id: yt[1],
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&playsinline=1&rel=0&color=white`
    };
  }
  const vm = trimmed.match(/(?:vimeo\.com\/(?!channels|groups|album)[\w/]*|player\.vimeo\.com\/(?:video|progressive_redirect)\/)(\d{6,})/);
  if (vm) {
    return {
      kind: 'vimeo',
      id: vm[1],
      embedUrl: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&title=0&byline=0&portrait=0`
    };
  }
  return null; // assume a direct MP4 / streamable URL
}

// Embeds (iframes) can't feed a WebGL VideoTexture, so in VR headsets we show
// this notice on the 3D screen instead of a black void.
function createEmbedPlaceholderTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1024, 576);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#0a0f1d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 576);
  ctx.strokeStyle = 'rgba(245,158,11,0.6)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(24, 24, 976, 528, 28);
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 64px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'youtube' ? '▶ YouTube clip' : '▶ Vimeo clip', 512, 230);
  ctx.font = '28px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Embedded players can only run in the desktop view.', 512, 310);
  ctx.fillText('Exit VR and reopen this hotspot to watch it.', 512, 350);
  return new THREE.CanvasTexture(canvas);
}

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
            <span>Exhibit Video Spotlight</span>
          </div>
          <button class="modal-close-btn" id="btn-close-video-popup" title="Close Video (Esc)">✕</button>
        </div>

        <div class="video-player-container" id="video-player-container">
          <video id="dom-popup-video" playsinline preload="auto" loop crossorigin="anonymous" class="popup-video-element"></video>
          <iframe id="dom-popup-embed" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen title="Embedded video"></iframe>

          <div class="vp-seek-chip" id="vp-seek-chip" aria-live="polite"></div>

          <button class="vp-big-play" id="vp-big-play" aria-label="Play video">
            ${ICON_PLAY}
          </button>

          <div class="vp-controls" id="vp-controls">
            <div class="vp-scrubber" id="vp-scrubber" title="Seek">
              <div class="vp-scrub-fill" id="vp-scrub-fill"></div>
              <div class="vp-scrub-thumb" id="vp-scrub-thumb"></div>
            </div>
            <div class="vp-controls-row">
              <button class="vp-btn" id="vp-play" title="Play / Pause">
                <span id="vp-play-icon">${ICON_PLAY}</span>
              </button>
              <button class="vp-btn" id="vp-rewind" title="Back 10 seconds">${ICON_BACK_10}</button>
              <button class="vp-btn" id="vp-forward" title="Forward 10 seconds">${ICON_FORWARD_10}</button>
              <span class="vp-time">
                <span id="vp-time-current">0:00</span>
                <span class="vp-time-divider">/</span>
                <span id="vp-time-duration">0:00</span>
              </span>
              <span class="vp-spacer"></span>
              <button class="vp-btn" id="vp-mute" title="Mute / Unmute">${ICON_VOL_HIGH}</button>
              <input type="range" id="vp-volume" class="vp-volume" min="0" max="1" step="0.05" value="1" aria-label="Volume" />
              <button class="vp-btn" id="vp-fullscreen" title="Fullscreen">${ICON_FULLSCREEN}</button>
            </div>
          </div>
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

    this.bindVideoControls();
  }

  bindVideoControls() {
    const v = this.domVideo;
    if (!v) return;

    const container = document.getElementById('video-player-container');
    const bigPlay = document.getElementById('vp-big-play');
    const playBtn = document.getElementById('vp-play');
    const playIcon = document.getElementById('vp-play-icon');
    const rewindBtn = document.getElementById('vp-rewind');
    const forwardBtn = document.getElementById('vp-forward');
    const scrubber = document.getElementById('vp-scrubber');
    const fill = document.getElementById('vp-scrub-fill');
    const thumb = document.getElementById('vp-scrub-thumb');
    const curEl = document.getElementById('vp-time-current');
    const durEl = document.getElementById('vp-time-duration');
    const muteBtn = document.getElementById('vp-mute');
    const volEl = document.getElementById('vp-volume');
    const fsBtn = document.getElementById('vp-fullscreen');

    const fmt = (s) => {
      if (!isFinite(s) || s < 0) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const syncMuteIcon = () => {
      muteBtn.innerHTML = v.muted || v.volume === 0 ? ICON_VOL_MUTE : ICON_VOL_HIGH;
    };

    const togglePlay = () => {
      if (v.paused) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    };

    bigPlay.addEventListener('click', togglePlay);
    playBtn.addEventListener('click', togglePlay);
    v.addEventListener('click', togglePlay);

    const showSeekChip = (delta) => {
      const chip = document.getElementById('vp-seek-chip');
      if (!chip) return;
      chip.textContent = delta < 0 ? `⏪ −${Math.abs(delta)}s` : `⏩ +${delta}s`;
      chip.classList.add('show');
      clearTimeout(this._seekChipTimer);
      this._seekChipTimer = setTimeout(() => {
        chip.classList.remove('show');
      }, 800);
    };

    rewindBtn.addEventListener('click', () => {
      showSeekChip(-10);
      v.currentTime = Math.max(0, v.currentTime - 10);
    });
    forwardBtn.addEventListener('click', () => {
      showSeekChip(10);
      v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
    });

    v.addEventListener('play', () => {
      playIcon.innerHTML = ICON_PAUSE;
      bigPlay.classList.add('hidden');
      container.classList.add('is-playing');
      this._scheduleControlsHide();
    });
    v.addEventListener('pause', () => {
      playIcon.innerHTML = ICON_PLAY;
      bigPlay.classList.remove('hidden');
      container.classList.remove('is-playing');
      container.classList.remove('controls-hidden');
    });
    v.addEventListener('ended', () => {
      playIcon.innerHTML = ICON_PLAY;
      bigPlay.classList.remove('hidden');
      container.classList.remove('is-playing', 'controls-hidden');
    });

    v.addEventListener('loadedmetadata', () => {
      durEl.textContent = fmt(v.duration);
    });
    v.addEventListener('durationchange', () => {
      durEl.textContent = fmt(v.duration);
    });
    v.addEventListener('timeupdate', () => {
      const pct = v.duration ? (v.currentTime / v.duration) * 100 : 0;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      curEl.textContent = fmt(v.currentTime);
    });
    v.addEventListener('volumechange', syncMuteIcon);

    // Scrubber (click + drag)
    const seekFromEvent = (e) => {
      const rect = scrubber.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      if (v.duration) v.currentTime = ratio * v.duration;
    };
    scrubber.addEventListener('pointerdown', (e) => {
      scrubber.classList.add('scrubbing');
      scrubber.setPointerCapture(e.pointerId);
      seekFromEvent(e);
      e.preventDefault();
    });
    scrubber.addEventListener('pointermove', (e) => {
      if (scrubber.classList.contains('scrubbing')) seekFromEvent(e);
    });
    scrubber.addEventListener('pointerup', (e) => {
      scrubber.classList.remove('scrubbing');
      scrubber.releasePointerCapture?.(e.pointerId);
    });
    scrubber.addEventListener('pointercancel', () => {
      scrubber.classList.remove('scrubbing');
    });

    muteBtn.addEventListener('click', () => {
      v.muted = !v.muted;
      syncMuteIcon();
    });
    volEl.addEventListener('input', (e) => {
      v.volume = parseFloat(e.target.value);
      v.muted = v.volume === 0;
      syncMuteIcon();
    });

    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else if (container.requestFullscreen || container.webkitRequestFullscreen) {
        (container.requestFullscreen || container.webkitRequestFullscreen).call(container);
      }
    });

    // Auto-hide controls while playing
    container.addEventListener('pointermove', () => {
      container.classList.remove('controls-hidden');
      this._scheduleControlsHide();
    });
    container.addEventListener('pointerleave', () => {
      this._scheduleControlsHide();
    });
  }

  _scheduleControlsHide() {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    if (this._hideTimer) clearTimeout(this._hideTimer);
    if (!container.classList.contains('is-playing')) return;
    this._hideTimer = setTimeout(() => {
      container.classList.add('controls-hidden');
    }, 2600);
  }

  resetPlayerUI() {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    if (this._seekChipTimer) {
      clearTimeout(this._seekChipTimer);
      this._seekChipTimer = null;
    }
    const chip = document.getElementById('vp-seek-chip');
    if (chip) chip.classList.remove('show');
    // Leave embed mode: drop the iframe back to the <video> player.
    const embedFrame = document.getElementById('dom-popup-embed');
    if (embedFrame) embedFrame.removeAttribute('src');
    const container = document.getElementById('video-player-container');
    if (container) container.classList.remove('embed-mode');
    if (container) container.classList.remove('controls-hidden', 'is-playing');
    const playIcon = document.getElementById('vp-play-icon');
    if (playIcon) playIcon.innerHTML = ICON_PLAY;
    const bigPlay = document.getElementById('vp-big-play');
    if (bigPlay) bigPlay.classList.remove('hidden');
    const fill = document.getElementById('vp-scrub-fill');
    if (fill) fill.style.width = '0%';
    const thumb = document.getElementById('vp-scrub-thumb');
    if (thumb) thumb.style.left = '0%';
    const cur = document.getElementById('vp-time-current');
    if (cur) cur.textContent = '0:00';
    const dur = document.getElementById('vp-time-duration');
    if (dur) dur.textContent = '0:00';
    const muteBtn = document.getElementById('vp-mute');
    if (muteBtn) muteBtn.innerHTML = ICON_VOL_HIGH;
    const vol = document.getElementById('vp-volume');
    if (vol) vol.value = 1;
    const scrubber = document.getElementById('vp-scrubber');
    if (scrubber) scrubber.classList.remove('scrubbing');
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
    // One single <video> element feeds BOTH the WebGL VideoTexture (VR screen)
    // and the desktop HTML5 player. A single element means picture and audio
    // share one clock, so they can never drift or double-audio during a popup.
    const sourceElement = this.domVideo;
    if (!sourceElement) return;

    // Single <video> element feeds BOTH the WebGL VideoTexture (VR screen)
    // and the desktop HTML5 player, keeping picture+audio on one clock.
    // YouTube/Vimeo embeds can't texture a WebGL surface, so VR gets a notice.
    const embed = detectEmbed(videoData.sourceUrl);
    this.videoTexture = embed
      ? createEmbedPlaceholderTexture(embed.kind)
      : new THREE.VideoTexture(sourceElement);
    if (this.videoTexture && !embed) {
      this.videoTexture.colorSpace = THREE.SRGBColorSpace;
      this.videoTexture.minFilter = THREE.LinearFilter;
      this.videoTexture.magFilter = THREE.LinearFilter;
    }

    // Soft amber ambient halo behind the screen (matches the video-spotlight theme)
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const gctx = glowCanvas.getContext('2d');
    const glowGrad = gctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.55)');
    glowGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.16)');
    glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    gctx.fillStyle = glowGrad;
    gctx.fillRect(0, 0, 256, 256);
    const glowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.6),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(glowCanvas),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      })
    );
    glowMesh.position.set(0, 0, -0.08);
    this.modalGroup.add(glowMesh);

    // Rounded-corner alpha mask so the video sits inside the bezel like a cinema screen
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = 1024;
    maskCanvas.height = 576;
    const mctx = maskCanvas.getContext('2d');
    mctx.fillStyle = '#000000';
    mctx.fillRect(0, 0, 1024, 576);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    const r = 36;
    mctx.moveTo(r, 0);
    mctx.lineTo(1024 - r, 0);
    mctx.arcTo(1024, 0, 1024, r, r);
    mctx.lineTo(1024, 576 - r);
    mctx.arcTo(1024, 576, 1024 - r, 576, r);
    mctx.lineTo(r, 576);
    mctx.arcTo(0, 576, 0, 576 - r, r);
    mctx.lineTo(0, r);
    mctx.arcTo(0, 0, r, 0, r);
    mctx.closePath();
    mctx.fill();

    // 16:9 Cinema Screen (1.6m x 0.9m)
    const screenGeo = new THREE.PlaneGeometry(1.6, 0.9);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      alphaMap: new THREE.CanvasTexture(maskCanvas),
      transparent: true,
      side: THREE.FrontSide,
      toneMapped: false
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 0, 0);
    this.modalGroup.add(this.screenMesh);

    // Outer Bezel / Frame
    const frameGeo = new THREE.BoxGeometry(1.68, 0.98, 0.04);
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

    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 256);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#0a0f1d');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 256, 32);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.stroke();

    // NOW PLAYING eyebrow
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(52, 52, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 26px Inter, sans-serif';
    ctx.fillText('NOW PLAYING', 76, 61);

    ctx.font = 'bold 44px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(videoData.title || this.activeData.title || 'Video Spotlight', 48, 130);

    ctx.font = '30px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(videoData.caption || this.activeData.subtitle || 'Click Close to return to tour', 48, 190);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(1.6, 0.4);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, -0.74, 0);
    this.modalGroup.add(labelMesh);

    // 3D Close Button in VR
    const btnGeo = new THREE.BoxGeometry(0.26, 0.09, 0.04);
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0xef4444,
      emissiveIntensity: 0.15
    });
    const closeBtn = new THREE.Mesh(btnGeo, btnMat);
    closeBtn.position.set(0.64, 0.57, 0.02);
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
    cCtx.font = 'bold 46px sans-serif';
    cCtx.textAlign = 'center';
    cCtx.textBaseline = 'middle';
    cCtx.fillText('✕ Close', 128, 64);
    const closeTex = new THREE.CanvasTexture(closeCanvas);
    const closeTextPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.08),
      new THREE.MeshBasicMaterial({ map: closeTex, transparent: true })
    );
    closeTextPlane.position.set(0.64, 0.57, 0.045);
    this.modalGroup.add(closeTextPlane);
  }

  showDesktopOverlay(videoData) {
    if (!this.domOverlay) return;

    document.getElementById('video-popup-title').textContent =
      videoData.title || this.activeData.title || 'Video Spotlight';
    document.getElementById('video-popup-desc').textContent =
      videoData.caption || this.activeData.subtitle || '';

    this.resetPlayerUI();

    const embed = detectEmbed(videoData.sourceUrl);
    if (embed) {
      // YouTube / Vimeo: hand playback to the provider's embed player.
      // It brings its own controls (the custom <video> ones can't drive a
      // cross-origin iframe), so the container just enters embed-mode.
      if (this.domVideo) {
        this.domVideo.pause();
        this.domVideo.removeAttribute('src');
        this.domVideo.load();
      }
      const frame = document.getElementById('dom-popup-embed');
      if (frame) {
        const title = videoData.title || this.activeData.title || 'Embedded video';
        frame.title = title;
        frame.src = embed.embedUrl;
      }
      const container = document.getElementById('video-player-container');
      if (container) container.classList.add('embed-mode');
    } else if (this.domVideo) {
      this.domVideo.src = videoData.sourceUrl || '';
      this.domVideo.load();
      this.domVideo.play().catch(() => {
        // Autoplay blocked — the big play button stays visible
      });
    }

    this.domOverlay.classList.add('active');
  }

  cleanUp3D() {
    this.interactiveMeshes.forEach((mesh) => {
      this.xrControllerManager.removeInteractiveObject(mesh);
      this.inputManager.removeInteractiveObject(mesh);
    });
    this.interactiveMeshes = [];

    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }

    while (this.modalGroup.children.length > 0) {
      const child = this.modalGroup.children[0];
      this.modalGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          if (m.alphaMap) m.alphaMap.dispose();
          m.dispose();
        });
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
    const embedFrame = document.getElementById('dom-popup-embed');
    if (embedFrame) embedFrame.removeAttribute('src');
    const playerContainer = document.getElementById('video-player-container');
    if (playerContainer) playerContainer.classList.remove('embed-mode');

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

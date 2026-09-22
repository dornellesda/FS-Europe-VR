const ICON_PLAY = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-left: 2px;"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
const ICON_BACK_10 = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.5 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16.3" text-anchor="middle" font-size="7.2" font-weight="800" font-family="Arial, Helvetica, sans-serif">10</text></svg>`;
const ICON_FORWARD_10 = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.5 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="16.3" text-anchor="middle" font-size="7.2" font-weight="800" font-family="Arial, Helvetica, sans-serif">10</text></svg>`;
const ICON_VOL_HIGH = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const ICON_VOL_MUTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

export class VideoHUD {
  constructor(videoSphere, activeTour, callbacks = {}) {
    this.videoSphere = videoSphere;
    this.activeTour = activeTour;
    this.hotspotsData = activeTour?.hotspots || [];
    this.onOpenCatalog = callbacks.onOpenCatalog;
    this.onOpenAdmin = callbacks.onOpenAdmin;
    this.onToggleCalib = callbacks.onToggleCalib;

    this.container = document.getElementById('video-hud');
    this.setupHUD();
    this.setupDragAndDrop();
    this.bindEvents();
  }

  setTour(tour) {
    this.activeTour = tour;
    this.hotspotsData = tour?.hotspots || [];

    const titleEl = document.getElementById('hud-active-tour-title');
    if (titleEl) {
      titleEl.textContent = tour.title;
    }

    const tagEl = document.getElementById('hud-tag');
    if (tagEl) {
      tagEl.textContent = tour.category || '360 Experience';
    }

    const duration = tour.duration || 120;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const durEl = document.getElementById('time-duration');
    if (durEl) {
      durEl.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    this.renderHotspotMarkers();
  }

  setupHUD() {
    if (!this.container) return;

    this.container.innerHTML = `
      <!-- Top Brand Header -->
      <div class="hud-top-bar">
        <div class="hud-brand" id="btn-brand-menu" title="Click to browse tours">
          <div class="pulse-dot"></div>
          <span class="hud-title" id="hud-active-tour-title">${this.activeTour?.title || 'FamilySearch Europe VR'}</span>
          <span class="hud-tag" id="hud-tag">${this.activeTour?.category || '360 Experience'}</span>
        </div>

        <div class="hud-top-actions">
          <button class="btn-glass" id="btn-open-catalog" title="Browse available VR tours and exhibits">
            <span>🗺️ Tours Menu</span>
          </button>
          <button class="btn-glass" id="btn-open-admin" title="Open Creator Studio & Admin Hub" style="display: none;">
            <span>⚙️ Admin Studio</span>
          </button>
          <button class="btn-glass" id="btn-toggle-calib" title="Toggle Hotspot Calibration Crosshair (Key: C)" style="display: none;">
            <span>🎯 Calibration</span>
          </button>
          <label class="btn-glass file-upload-label" title="Load your Insta360 4K MP4 file directly" style="display: none;">
            <span>📁 Load MP4</span>
            <input type="file" id="video-file-input" accept="video/mp4,video/*" style="display:none;" />
          </label>
        </div>
      </div>

      <!-- Drag and Drop Overlay Notice -->
      <div class="drag-drop-hint" id="drag-drop-hint">
        <div class="hint-box">
          <span class="hint-icon">📽️</span>
          <h3>Drop your Insta360 4K MP4 here</h3>
          <p>Instant in-memory 360 playback (no server upload required)</p>
        </div>
      </div>

      <!-- Floating Bottom Control Dock -->
      <div class="hud-bottom-bar">
        <!-- Transient seek feedback chip (instant feedback for ±10s skips) -->
        <div class="seek-indicator" id="seek-indicator" aria-live="polite"></div>

        <!-- Scrubber & Hotspot Indicators -->
        <div class="timeline-container">
          <div class="timeline-track" id="timeline-track">
            <!-- Background Cue Markers on Scrubber -->
            <div class="hotspot-markers-container" id="hotspot-markers"></div>
            <div class="timeline-progress" id="timeline-progress">
              <span class="timeline-thumb"></span>
            </div>
          </div>
        </div>

        <div class="controls-row">
          <!-- Rewind 10s -->
          <button class="btn-control" id="btn-rewind-10" title="Rewind 10 seconds (←)" aria-label="Rewind 10 seconds">
            ${ICON_BACK_10}
          </button>

          <!-- Play / Pause -->
          <button class="btn-control" id="btn-play-pause" title="Play/Pause (Space)" aria-label="Play or Pause">
            <span id="play-icon">${ICON_PLAY}</span>
          </button>

          <!-- Forward 10s -->
          <button class="btn-control" id="btn-forward-10" title="Forward 10 seconds (→)" aria-label="Forward 10 seconds">
            ${ICON_FORWARD_10}
          </button>

          <!-- Current / Total Time -->
          <div class="time-display">
            <span id="time-current">00:00</span>
            <span class="time-divider">/</span>
            <span id="time-duration">02:00</span>
          </div>

          <div class="spacer"></div>

          <!-- Active Cue Status -->
          <div class="active-cue-pill" id="active-cue-pill" style="display: none;">
            <span class="cue-dot"></span>
            <span id="cue-text">Exhibit Active</span>
          </div>

          <!-- Volume Controls -->
          <div class="volume-container">
            <button class="btn-icon" id="btn-mute" title="Mute/Unmute" aria-label="Toggle Mute">${ICON_VOL_HIGH}</button>
            <input type="range" id="volume-slider" min="0" max="1" step="0.05" value="0.8" class="volume-slider" aria-label="Volume Slider" />
          </div>
        </div>
      </div>
    `;

    this.renderHotspotMarkers();
  }

  renderHotspotMarkers() {
    const container = document.getElementById('hotspot-markers');
    if (!container) return;

    container.innerHTML = '';
    const duration = this.videoSphere.duration || this.activeTour?.duration || 120;

    this.hotspotsData.forEach((h) => {
      const leftPercent = (h.timeStart / duration) * 100;
      const widthPercent = Math.max(1.2, ((h.timeEnd - h.timeStart) / duration) * 100);

      const marker = document.createElement('div');
      const colorClass = h.type === 'interactive-exhibit' ? 'blue' : h.type === 'video-popup' ? 'amber' : 'green';
      marker.className = `timeline-marker ${colorClass}`;
      marker.style.left = `${leftPercent}%`;
      marker.style.width = `${widthPercent}%`;
      marker.title = `${h.title} (${h.timeStart}s - ${h.timeEnd}s)`;
      container.appendChild(marker);
    });
  }

  setupDragAndDrop() {
    const dropHint = document.getElementById('drag-drop-hint');

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dropHint) dropHint.classList.add('visible');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.clientX <= 0 || e.clientY <= 0) {
        if (dropHint) dropHint.classList.remove('visible');
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dropHint) dropHint.classList.remove('visible');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('video/')) {
          this.videoSphere.loadLocalFile(file);
          this.showNotice(`Loaded 360 Video: ${file.name}`);
        }
      }
    });
  }

  bindEvents() {
    // Open Catalog Menu
    document.getElementById('btn-open-catalog')?.addEventListener('click', () => {
      if (this.onOpenCatalog) this.onOpenCatalog();
    });
    document.getElementById('btn-brand-menu')?.addEventListener('click', () => {
      if (this.onOpenCatalog) this.onOpenCatalog();
    });

    // Open Admin Hub
    document.getElementById('btn-open-admin')?.addEventListener('click', () => {
      if (this.onOpenAdmin) this.onOpenAdmin();
    });

    // Toggle Calibration
    document.getElementById('btn-toggle-calib')?.addEventListener('click', () => {
      if (this.onToggleCalib) this.onToggleCalib();
    });

    // Play / Pause
    const playPauseBtn = document.getElementById('btn-play-pause');
    const playIcon = document.getElementById('play-icon');
    if (playPauseBtn) {
      playPauseBtn.onclick = () => this.videoSphere.togglePlay();
    }

    // Rewind / Forward 10 seconds
    const showSeekFeedback = (delta) => {
      const chip = document.getElementById('seek-indicator');
      if (!chip) return;
      chip.textContent = delta < 0 ? `⏪ −${Math.abs(delta)}s` : `⏩ +${delta}s`;
      chip.classList.remove('show');
      void chip.offsetWidth; // restart CSS animation
      chip.classList.add('show');
      clearTimeout(this._seekChipTimer);
      this._seekChipTimer = setTimeout(() => {
        chip.classList.remove('show');
      }, 900);
    };

    document.getElementById('btn-rewind-10')?.addEventListener('click', () => {
      showSeekFeedback(-10);
      this.videoSphere.seek(this.videoSphere.currentTime - 10);
    });
    document.getElementById('btn-forward-10')?.addEventListener('click', () => {
      showSeekFeedback(10);
      this.videoSphere.seek(this.videoSphere.currentTime + 10);
    });

    // Timeline Scrubber
    const track = document.getElementById('timeline-track');
    if (track) {
      track.onclick = (e) => {
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const progress = Math.max(0, Math.min(1, clickX / rect.width));
        const duration = this.videoSphere.duration || this.activeTour?.duration || 120;
        this.videoSphere.seek(progress * duration);
      };
    }

    // Volume Slider
    const volumeSlider = document.getElementById('volume-slider');
    const muteBtn = document.getElementById('btn-mute');
    if (volumeSlider) {
      volumeSlider.oninput = (e) => {
        const vol = parseFloat(e.target.value);
        this.videoSphere.setVolume(vol);
        if (muteBtn) muteBtn.innerHTML = vol === 0 ? ICON_VOL_MUTE : ICON_VOL_HIGH;
      };
    }

    if (muteBtn) {
      muteBtn.onclick = () => {
        const isMuted = this.videoSphere.isMuted();
        this.videoSphere.setMuted(!isMuted);
        muteBtn.innerHTML = !isMuted ? ICON_VOL_MUTE : ICON_VOL_HIGH;
      };
    }

    // File Input
    const fileInput = document.getElementById('video-file-input');
    if (fileInput) {
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.videoSphere.loadLocalFile(file);
          this.showNotice(`Loaded 360 Video: ${file.name}`);
        }
      };
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.videoSphere.togglePlay();
      } else if (e.code === 'KeyC') {
        if (this.onToggleCalib) this.onToggleCalib();
      } else if (e.code === 'KeyM') {
        if (this.onOpenCatalog) this.onOpenCatalog();
      }
    });

    // Sync with VideoSphere
    this.videoSphere.addEventListener('timeupdate', (data) => {
      this.updateTimeline(data.currentTime, data.duration);
      this.updateActiveCue(data.currentTime);
    });

    this.videoSphere.addEventListener('play', () => {
      if (playIcon) playIcon.innerHTML = ICON_PAUSE;
    });

    this.videoSphere.addEventListener('pause', () => {
      if (playIcon) playIcon.innerHTML = ICON_PLAY;
    });
  }

  updateTimeline(currentTime, duration) {
    const progressEl = document.getElementById('timeline-progress');
    const currentEl = document.getElementById('time-current');
    const durationEl = document.getElementById('time-duration');

    const total = duration || this.activeTour?.duration || 120;
    const percent = Math.min(100, Math.max(0, (currentTime / total) * 100));

    if (progressEl) progressEl.style.width = `${percent}%`;

    if (currentEl) {
      const curM = Math.floor(currentTime / 60);
      const curS = Math.floor(currentTime % 60);
      currentEl.textContent = `${curM < 10 ? '0' : ''}${curM}:${curS < 10 ? '0' : ''}${curS}`;
    }

    if (durationEl && duration) {
      const durM = Math.floor(duration / 60);
      const durS = Math.floor(duration % 60);
      durationEl.textContent = `${durM < 10 ? '0' : ''}${durM}:${durS < 10 ? '0' : ''}${durS}`;
    }
  }

  updateActiveCue(currentTime) {
    const cuePill = document.getElementById('active-cue-pill');
    const cueText = document.getElementById('cue-text');
    if (!cuePill || !cueText) return;

    const active = this.hotspotsData.find(
      (h) => currentTime >= h.timeStart && currentTime <= h.timeEnd
    );

    if (active) {
      cuePill.style.display = 'inline-flex';
      cueText.textContent = active.title;
    } else {
      cuePill.style.display = 'none';
    }
  }

  showNotice(msg) {
    console.log('[VideoHUD Notice]:', msg);
  }
}

export class CalibrationOverlay {
  constructor(inputManager, videoSphere) {
    this.inputManager = inputManager;
    this.videoSphere = videoSphere;
    this.isEnabled = false;

    this.container = document.getElementById('calibration-hud');
    this.setupUI();
    this.setupEvents();
  }

  setupUI() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="calib-panel">
        <div class="calib-header">
          <div class="calib-indicator"></div>
          <span class="calib-title">CALIBRATION & HOTSPOT AUTHORING</span>
          <button class="calib-close-btn" id="calib-close-btn">✕</button>
        </div>
        <div class="calib-grid">
          <div class="calib-metric">
            <span class="calib-label">VIDEO TIMESTAMP</span>
            <span class="calib-value" id="calib-time">00:00.00</span>
          </div>
          <div class="calib-metric">
            <span class="calib-label">YAW (HORIZONTAL)</span>
            <span class="calib-value" id="calib-yaw">0.0°</span>
          </div>
          <div class="calib-metric">
            <span class="calib-label">PITCH (VERTICAL)</span>
            <span class="calib-value" id="calib-pitch">0.0°</span>
          </div>
        </div>
        <div class="calib-guide">
          Look or drag toward any exhibit or QR code in your Insta360 video, then click below to copy the hotspot coordinate template.
        </div>
        <div class="calib-actions">
          <button class="btn-calib-action" id="btn-copy-interactive-json">
            ✦ Copy Interactive Exhibit JSON
          </button>
          <button class="btn-calib-action green" id="btn-copy-qr-json">
            ⛶ Copy QR Code Link JSON
          </button>
        </div>
        <div class="calib-toast" id="calib-toast"></div>
      </div>
    `;

    document.getElementById('calib-close-btn')?.addEventListener('click', () => {
      this.toggle(false);
    });

    document.getElementById('btn-copy-interactive-json')?.addEventListener('click', () => {
      this.copyTemplate('interactive-exhibit');
    });

    document.getElementById('btn-copy-qr-json')?.addEventListener('click', () => {
      this.copyTemplate('qr-code');
    });
  }

  setupEvents() {
    window.addEventListener('exhibit-toggle-calibration', () => {
      this.toggle();
    });
  }

  toggle(forceState) {
    this.isEnabled = forceState !== undefined ? forceState : !this.isEnabled;
    if (this.container) {
      if (this.isEnabled) {
        this.container.classList.add('active');
      } else {
        this.container.classList.remove('active');
      }
    }
  }

  copyTemplate(type) {
    const angles = this.inputManager.getCurrentAngles();
    const time = this.videoSphere.currentTime;
    const timeStart = Math.max(0, Math.floor(time));
    const timeEnd = timeStart + 30;

    let snippet = '';
    if (type === 'interactive-exhibit') {
      snippet = JSON.stringify(
        {
          id: `exhibit-${Date.now().toString().slice(-4)}`,
          type: "interactive-exhibit",
          title: "New Interactive Exhibit",
          subtitle: "Touch to inspect & interact in VR",
          timeStart: timeStart,
          timeEnd: timeEnd,
          yaw: parseFloat(angles.yaw),
          pitch: parseFloat(angles.pitch),
          distance: 3.8,
          exhibitData: {
            title: "Artifact Title",
            category: "Gallery Feature",
            description: "Describe what the guide is pointing at in this section...",
            modelType: "astrolabe",
            features: [
              { id: "action-1", label: "Inspect Mechanism", action: "spin" }
            ]
          }
        },
        null,
        2
      );
    } else {
      snippet = JSON.stringify(
        {
          id: `qr-${Date.now().toString().slice(-4)}`,
          type: "qr-code",
          title: "Exhibit Information QR",
          subtitle: "Touch to scan and open web link",
          timeStart: timeStart,
          timeEnd: timeEnd,
          yaw: parseFloat(angles.yaw),
          pitch: parseFloat(angles.pitch),
          distance: 3.5,
          qrData: {
            url: "https://your-museum-link.com",
            displayUrl: "your-museum-link.com",
            title: "Exhibit Digital Page",
            description: "Additional digital information and scholar commentaries."
          }
        },
        null,
        2
      );
    }

    navigator.clipboard.writeText(snippet);
    this.showToast(`✓ Copied ${type} snippet to clipboard!`);
  }

  showToast(msg) {
    const toast = document.getElementById('calib-toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  update() {
    if (!this.isEnabled) return;

    const timeElem = document.getElementById('calib-time');
    const yawElem = document.getElementById('calib-yaw');
    const pitchElem = document.getElementById('calib-pitch');

    if (timeElem) {
      const cur = this.videoSphere.currentTime;
      const mins = Math.floor(cur / 60);
      const secs = (cur % 60).toFixed(2);
      timeElem.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(5, '0')}`;
    }

    const angles = this.inputManager.getCurrentAngles();
    if (yawElem) {
      yawElem.textContent = `${angles.yaw > 0 ? '+' : ''}${angles.yaw}°`;
    }
    if (pitchElem) {
      pitchElem.textContent = `${angles.pitch > 0 ? '+' : ''}${angles.pitch}°`;
    }
  }
}

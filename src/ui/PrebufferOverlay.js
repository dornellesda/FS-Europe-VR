export class PrebufferOverlay {
  constructor(videoSphere) {
    this.videoSphere = videoSphere;

    this.el = document.getElementById('prebuffer-overlay');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'prebuffer-overlay';
      this.el.className = 'prebuffer-overlay';
      this.el.innerHTML = `
        <div class="pb-card">
          <div class="pb-ring-wrap">
            <div class="pb-ring" id="pb-ring">
              <div class="pb-ring-core">
                <span class="pb-pct" id="pb-pct">0%</span>
                <span class="pb-label">buffered</span>
              </div>
            </div>
          </div>
          <div class="pb-copy">
            <div class="pb-title">Preparing your seamless 360° experience</div>
            <div class="pb-sub">Buffering ahead so the tour never pauses — this only happens once per video.</div>
            <button class="btn-action-primary green" id="btn-skip-prebuffer">▶ Skip &amp; Start Now</button>
          </div>
        </div>
      `;
      document.body.appendChild(this.el);
    }

    this._percentEl = this.el.querySelector('#pb-pct');
    this._ringEl = this.el.querySelector('#pb-ring');
    this._skipBtn = this.el.querySelector('#btn-skip-prebuffer');

    this._bind();
  }

  _bind() {
    this.videoSphere.addEventListener('loading', () => this.show());
    this.videoSphere.addEventListener('prebuffer', (d) => this._onPrebuffer(d));
    this.videoSphere.addEventListener('error', () => this.hide(0));

    // Playback actually started (non-prebuffer path or after skip) — dismiss.
    this.videoSphere.addEventListener('play', () => {
      if (this.videoSphere.hasFirstFrame && this.videoSphere.isUsingRealVideo) {
        this.hide(0);
      }
    });

    // DOM overlays don't exist inside a VR headset — let the prebuffer run in
    // the background and tear the intro away before entering the session.
    window.addEventListener('exhibit-session-start', () => this.hide(0));

    this._skipBtn?.addEventListener('click', () => this.videoSphere.skipPrebuffer());

    // Any tap outside the card = skip.
    this.el.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.pb-card')) this.videoSphere.skipPrebuffer();
    });
  }

  _onPrebuffer(d) {
    if (!d) return;
    if (d.state === 'ready') {
      this.hide();
      return;
    }
    const pct = d.duration > 0
      ? Math.min(99, Math.max(0, Math.round((d.bufferedUntil / d.duration) * 100)))
      : 0;
    if (this._percentEl) this._percentEl.textContent = `${pct}%`;
    if (this._ringEl) {
      this._ringEl.style.setProperty('--pb-progress', `${pct}%`);
    }
  }

  show() {
    if (this._percentEl) this._percentEl.textContent = '0%';
    if (this._ringEl) this._ringEl.style.setProperty('--pb-progress', '0%');
    this.el.classList.add('active');
  }

  hide(fadeDelay = 350) {
    if (!this.el.classList.contains('active')) return;
    setTimeout(() => this.el.classList.remove('active'), fadeDelay);
  }
}
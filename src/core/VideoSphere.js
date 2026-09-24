import * as THREE from 'three';
import { createProcedural360Canvas } from '../utils/proceduralGallery.js';

export class VideoSphere {
  constructor(scene) {
    this.scene = scene;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 120; // Default 2-minute simulated duration for demo
    this.isUsingRealVideo = false;
    this.hasFirstFrame = false;
    this.isBuffering = false;
    this._sourceUrl = '';
    this._pendingPlay = false;
    this._resumeOnGesture = false;
    this._gestureHandler = null;
    this._frameSyncHandle = null;
    this.listeners = {
      timeupdate: [],
      play: [],
      pause: [],
      loadedmetadata: [],
      loading: [],
      ready: [],
      buffering: [],
      prebuffer: [],
      error: []
    };

    // No-pause buffering: before the first play, warm the browser cache with
    // the WHOLE file and hold playback behind an intro until the front half
    // of the file has fully buffered. State is reset per loadUrl/useProcedural.
    this._prebufferEnabled = false;
    // URLs that already finished (or were skipped from) the no-pause warm-up
    // this session. Persists across loadUrl resets so the intro only ever
    // runs once per video, even when a tour save reloads the same file.
    this._prebufferedUrls = new Set();
    this._prebufferState = null; // null | 'buffering' | 'done'
    this._prebufferMode = 'seek'; // 'seek' | 'fetch' — how progress is driven
    this._fetchReader = null;
    this._suppressTime = false;
    this._prebufferPoll = null;
    this._prebufferTimer = null;
    this._lastBufferedPct = -1;
    this._lastAdvanceAt = 0;

    // Hidden HTML5 video element. Kept rendered but invisible —
    // `display: none` lets some browsers (Safari/iOS notably) deprioritize or
    // skip frame decoding entirely, which leaves the VideoTexture black.
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.playsInline = true;
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.preload = 'auto';
    this.video.loop = true;
    Object.assign(this.video.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '2px',
      height: '2px',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1'
    });
    document.body.appendChild(this.video);

    // Inverted 360 Sphere Geometry
    this.geometry = new THREE.SphereGeometry(500, 64, 40);
    // Invert geometry so faces point inward toward center
    this.geometry.scale(-1, 1, 1);

    // Initial texture: Procedural Museum Gallery
    this.proceduralCanvas = createProcedural360Canvas();
    this.canvasTexture = new THREE.CanvasTexture(this.proceduralCanvas);
    this.canvasTexture.colorSpace = THREE.SRGBColorSpace;
    this.canvasTexture.minFilter = THREE.LinearFilter;
    this.canvasTexture.magFilter = THREE.LinearFilter;

    // MeshBasicMaterial: unlit — scene lights have zero effect on the panorama.
    // toneMapped: false skips the renderer's ACESFilmic tone mapping entirely.
    // With SRGBColorSpace textures + SRGBColorSpace output, the round-trip is
    // net-zero: the panorama renders 1:1 with the raw source image.
    this.material = new THREE.MeshBasicMaterial({
      map: this.canvasTexture,
      color: 0xffffff,
      toneMapped: false,
    });
    // Dim base multiplier to keep bright source whites from clipping to pure white
    this.material.color.setScalar(0.75);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, 0);
    // Isolate the panorama to layer 1 so no scene lights can illuminate it
    this.mesh.layers.set(1);
    this.scene.add(this.mesh);

    this.setupVideoEvents();
  }

  setupVideoEvents() {
    this.video.addEventListener('loadedmetadata', () => {
      this.duration = this.video.duration || this.duration;
      // Only pre-buffer when the file has a real, seekable duration.
      // Progressive streams (duration = Infinity) can't be fully cached.
      this._prebufferEnabled = isFinite(this.video.duration) && this.video.duration > 0;
      this.emit('loadedmetadata', { duration: this.duration });
    });

    // First decodable frame is buffered — only now swap the gallery for the
    // VideoTexture, so the sphere is never black while the file downloads.
    this.video.addEventListener('loadeddata', () => {
      this._activateVideoTexture();
    });

    this.video.addEventListener('timeupdate', () => {
      if (this.isUsingRealVideo && !this._suppressTime) {
        this._emitTime();
      }
    });

    this.video.addEventListener('seeked', () => {
      if (this.isUsingRealVideo && !this._suppressTime) {
        this._emitTime();
      }
    });

    this.video.addEventListener('play', () => {
      this.isPlaying = true;
      this._pendingPlay = false;
      this._resumeOnGesture = false;
      this._detachGestureRetry();
      this._setBuffering(false);
      this._startFrameSync();
      this.emit('play');
    });

    this.video.addEventListener('pause', () => {
      this.isPlaying = false;
      this.emit('pause');
    });

    this.video.addEventListener('ended', () => {
      this.isPlaying = false;
      this.emit('pause');
    });

    // Buffering visibility: consumers (HUD) can show an honest state instead
    // of a player that claims to play while nothing is presented.
    this.video.addEventListener('waiting', () => this._setBuffering(true));
    this.video.addEventListener('stalled', () => this._setBuffering(true));
    this.video.addEventListener('playing', () => this._setBuffering(false));
    this.video.addEventListener('canplay', () => {
      this._setBuffering(false);
      // Safety net: intent says "playing" but the element is parked (e.g. the
      // initial play() raced the loader) — nudge it back. Skipped while the
      // no-pause pre-buffer is still warming the cache.
      if (this.isPlaying && this.video.paused && this.hasFirstFrame && this._prebufferState !== 'buffering') {
        this.video.play().catch(() => {
          this._resumeOnGesture = true;
          this._attachGestureRetry();
        });
      }
    });

    this.video.addEventListener('error', () => {
      if (!this._sourceUrl) return;
      console.warn(`360 video failed to load, falling back to gallery: ${this._sourceUrl}`);
      this._sourceUrl = '';
      this._pendingPlay = false;
      this._resumeOnGesture = false;
      this._detachGestureRetry();
      this.isUsingRealVideo = false;
      this.hasFirstFrame = false;
      this.isPlaying = false;
      this._setBuffering(false);
      this._resetPrebuffer();
      this.material.map = this.canvasTexture;
      this.material.needsUpdate = true;
      this.emit('error', { message: 'Video failed to load — showing gallery fallback.' });
      this.emit('pause');
    });
  }

  /**
   * First frame decoded: create the VideoTexture, swap it in, and start
   * playback if it was requested while the file was still loading.
   */
  _activateVideoTexture() {
    if (this.hasFirstFrame || !this._sourceUrl) return;
    this.hasFirstFrame = true;

    if (this.videoTexture) this.videoTexture.dispose();
    this.videoTexture = new THREE.VideoTexture(this.video);
    // SRGBColorSpace tells Three.js the video is already in sRGB gamma.
    // With NoToneMapping on the renderer, this creates a clean round-trip:
    // sRGB (texture) → linear (internal) → sRGB (screen output) = net zero transform.
    // This matches how Premiere and browser <video> elements display the footage.
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.generateMipmaps = false;

    this.material.map = this.videoTexture;
    this.material.needsUpdate = true;
    this.isUsingRealVideo = true;
    this.duration = this.video.duration || this.duration;
    this.currentTime = this.video.currentTime;

    this.emit('ready', { duration: this.duration });
    this._emitTime();
    this._startFrameSync();

    if (this._pendingPlay) {
      // This session already warmed (or visited) this exact file — replay
      // instantly instead of re-running the intro. The browser HTTP cache
      // still holds the bytes from the earlier prebuffer.
      if (this._prebufferedUrls.has(this._sourceUrl)) {
        this._startPlayback();
      } else if (this._canPrebuffer()) {
        // Warm the whole file first so the first play through never stalls.
        this._beginPrebuffer();
      } else {
        // Non-seekable source (moov at end → duration=Infinity): can't buffer
        // ahead, so tell the UI why instead of silently starting a stalling
        // video. Short files (<8s) skip the nag — they buffer instantly.
        if (this._sourceUrl && this.hasFirstFrame && !this._prebufferEnabled) {
          this._prebufferedUrls.add(this._sourceUrl);
          this.emit('prebuffer', {
            state: 'unsupported',
            reason: 'non-seekable',
            duration: this.video.duration
          });
        }
        this._startPlayback();
      }
    }
  }

  _canPrebuffer() {
    return this._prebufferEnabled &&
      isFinite(this.video.duration) &&
      this.video.duration > 8;
  }

  _bufferedUntil() {
    const b = this.video.buffered;
    if (!b || !b.length) return 0;
    let until = 0;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= until + 0.5) {
        until = Math.max(until, b.end(i));
      } else {
        break; // gap — only the front contiguous range matters
      }
    }
    return until;
  }

  _beginPrebuffer() {
    if (this._prebufferState || !this._sourceUrl) return;
    this._prebufferState = 'buffering';
    this._suppressTime = true;
    this._lastBufferedPct = -1;
    this._lastAdvanceAt = Date.now();
    this._prebufferMode = 'seek';
    const d = this.video.duration;

    this.emit('prebuffer', {
      state: 'buffering',
      bufferedUntil: 0,
      duration: d
    });

    // Preferred warm-up: stream the whole file through fetch() so the browser
    // HTTP cache holds every byte and the intro ring fills with honest byte
    // progress. Falls back to the tail-seek trick when fetch is unavailable
    // (no Content-Length, CORS-blocked, non-OK response).
    this._startFetchPrebuffer();

    this._prebufferPoll = setInterval(() => this._checkPrebuffer(), 300);

    // Failsafe: never trap the user behind the intro forever. Start no later
    // than ~15% of the clip length (clamped 5–20 s).
    const waitMs = Math.max(5000, Math.min(20000, d * 1000 * 0.15));
    this._prebufferTimer = setTimeout(() => this._finishPrebuffer(), waitMs);
  }

  /**
   * Stream the source over fetch() for cache warm-up. Reading (and discarding)
   * the body walks the whole file through the browser's HTTP cache without
   * holding it in JS memory, and real byte counts drive the intro ring.
   * Returns true when streaming progress is driving the overlay.
   */
  _startFetchPrebuffer() {
    const url = this._sourceUrl;
    if (!url || typeof fetch !== 'function') return;

    // blob: object URLs are already fully local — nothing to warm in the
    // network cache, so skip straight to playback.
    if (url.startsWith('blob:')) {
      this._finishPrebuffer();
      return;
    }

    fetch(url).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = parseInt(res.headers.get('Content-Length') || '', 10);
      const body = res.body;
      if (!body || typeof body.getReader !== 'function' || !Number.isFinite(total) || total <= 0) {
        throw new Error('No streamed progress available');
      }
      this._prebufferMode = 'fetch';
      this._fetchReader = body.getReader();
      let got = 0;
      const pump = () => {
        const reader = this._fetchReader;
        if (!reader || this._prebufferState !== 'buffering') return;
        return reader.read().then(({ done, value }) => {
          if (this._prebufferState !== 'buffering') return;
          if (done) {
            got = total;
            this._reportFetch(got, total);
            this._fetchReader = null;
            this._finishPrebuffer();
            return;
          }
          got += value ? value.length : 0;
          this._reportFetch(got, total);
          return pump();
        });
      };
      return pump();
    }).catch(() => {
      // Fetch warm-up isn't available (CORS / no range / network hiccup) —
      // fall back to the media-element tail-seek approach.
      this._fallbackToSeekPrebuffer();
    });
  }

  _reportFetch(got, total) {
    if (this._prebufferState !== 'buffering') return;
    const frac = Math.min(1, got / total);
    const whole = Math.floor(frac * 100);
    const d = isFinite(this.video.duration) ? this.video.duration : this.duration;
    this._lastAdvanceAt = Date.now();
    if (whole === this._lastBufferedPct) return; // throttle to whole percents
    this._lastBufferedPct = whole;
    this.emit('prebuffer', {
      state: 'buffering',
      bufferedUntil: frac * d,
      duration: d
    });
  }

  _fallbackToSeekPrebuffer() {
    this._fetchReader = null;
    if (this._prebufferState !== 'buffering') return;
    this._prebufferMode = 'seek';
    this._lastAdvanceAt = Date.now();
    this._lastBufferedPct = -1;

    // Force the browser to download the ENTIRE file by seeking near the tail.
    // Front ranges stream into the disk cache, so forward playback never has
    // to wait. Harmless no-op on servers/modes that ignore the seek.
    const d = this.video.duration;
    try {
      const seekable = this.video.seekable;
      if (isFinite(d) && d > 0 && seekable && seekable.length &&
          seekable.end(seekable.length - 1) >= d - 4) {
        this.video.currentTime = Math.max(0, d - 2);
      }
    } catch {}
  }

  _checkPrebuffer() {
    if (this._prebufferState !== 'buffering') return;

    // fetch() streaming drives the progress now — video.buffered is still
    // tiny (the element hasn't been seeked yet), so don't report it.
    if (this._prebufferMode === 'fetch') {
      if (Date.now() - this._lastAdvanceAt > 6000 && this._lastBufferedPct < 5) {
        // The stream stalled before making progress — start anyway rather
        // than hiding behind the intro forever.
        this._finishPrebuffer();
      }
      return;
    }

    const until = this._bufferedUntil();
    const d = this.video.duration;
    const pct = d > 0 ? (until / d) * 100 : 0;

    // The whole playable range is in the cache — begin without a stall.
    if (!isFinite(d) || pct >= 98) {
      this._finishPrebuffer();
      return;
    }

    const whole = Math.floor(pct);
    if (whole > this._lastBufferedPct) {
      this._lastBufferedPct = whole;
      this._lastAdvanceAt = Date.now();
      this.emit('prebuffer', { state: 'buffering', bufferedUntil: until, duration: d });
    } else if (Date.now() - this._lastAdvanceAt > 6000) {
      // Cache stalled (e.g. server without range support) — start anyway.
      this._finishPrebuffer();
    }
  }

  _finishPrebuffer() {
    if (this._prebufferState !== 'buffering') return;
    this._prebufferState = 'done';
    this._prebufferedUrls.add(this._sourceUrl);
    this._clearPrebufferTimers();
    this._suppressTime = false;
    try {
      this.video.currentTime = 0;
    } catch {}
    this.currentTime = 0;
    this.emit('prebuffer', {
      state: 'ready',
      duration: this.video.duration || this.duration
    });
    if (this.isUsingRealVideo && this.hasFirstFrame) {
      this._startPlayback();
    }
  }

  // Public: the user chose to skip the warm-up (intro "Skip" or Play press).
  skipPrebuffer() {
    if (this._prebufferState === 'buffering') {
      this._finishPrebuffer();
    }
  }

  // Whether this session already warmed (or visited) the given video URL —
  // lets UIs skip the "buffering ahead" intro for a repeat visit.
  isPrebuffered(url) {
    return this._prebufferedUrls.has(url !== undefined ? url : this._sourceUrl);
  }

  _clearPrebufferTimers() {
    if (this._fetchReader) {
      try { this._fetchReader.cancel(); } catch {}
      this._fetchReader = null;
    }
    if (this._prebufferPoll) {
      clearInterval(this._prebufferPoll);
      this._prebufferPoll = null;
    }
    if (this._prebufferTimer) {
      clearTimeout(this._prebufferTimer);
      this._prebufferTimer = null;
    }
  }

  _resetPrebuffer() {
    this._clearPrebufferTimers();
    this._prebufferEnabled = false;
    this._prebufferState = null;
    this._prebufferMode = 'seek';
    this._suppressTime = false;
    this._lastBufferedPct = -1;
    this._lastAdvanceAt = 0;
  }

  _startPlayback() {
    this._pendingPlay = false;
    this.video.play().then(() => {
      this._resumeOnGesture = false;
    }).catch((err) => {
      console.warn('Autoplay blocked, user interaction required:', err);
      this.isPlaying = false;
      this._resumeOnGesture = true;
      this._attachGestureRetry();
      this.emit('pause');
    });
  }

  // Autoplay-with-sound needs a user gesture on most browsers — arm a
  // one-shot retry so the first click/key starts the tour immediately.
  _attachGestureRetry() {
    if (this._gestureHandler) return;
    this._gestureHandler = () => {
      if (!this._resumeOnGesture || !this._sourceUrl) return;
      this._resumeOnGesture = false;
      this._detachGestureRetry();
      this.video.play().catch(() => {});
    };
    window.addEventListener('pointerdown', this._gestureHandler);
    window.addEventListener('keydown', this._gestureHandler);
  }

  _detachGestureRetry() {
    if (!this._gestureHandler) return;
    window.removeEventListener('pointerdown', this._gestureHandler);
    window.removeEventListener('keydown', this._gestureHandler);
    this._gestureHandler = null;
  }

  _setBuffering(buffering) {
    if (this.isBuffering === buffering) return;
    this.isBuffering = buffering;
    this.emit('buffering', { buffering });
  }

  _emitTime() {
    this.currentTime = this.video.currentTime;
    this.emit('timeupdate', {
      currentTime: this.currentTime,
      duration: this.duration
    });
  }

  /**
   * Frame-accurate timeline: while playing, re-emit timeupdate on every
   * presented video frame (requestVideoFrameCallback) so hotspots and the HUD
   * stay locked to the exact frame on screen — not the browser's ~250ms
   * timeupdate tick. The regular timeupdate listener remains as fallback.
   */
  _startFrameSync() {
    if (this._frameSyncHandle !== null) return;
    if (typeof this.video.requestVideoFrameCallback !== 'function') return;
    const onFrame = () => {
      this._frameSyncHandle = null;
      if (!this.isUsingRealVideo) return;
      if (!this._suppressTime) this._emitTime();
      if (!this.video.paused && !this.video.ended) {
        this._frameSyncHandle = this.video.requestVideoFrameCallback(onFrame);
      }
    };
    this._frameSyncHandle = this.video.requestVideoFrameCallback(onFrame);
  }

  loadLocalFile(file) {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    this.loadUrl(objectUrl);
  }

  setPanoRotationY(yawDeg = 0) {
    this.mesh.rotation.y = THREE.MathUtils.degToRad(-yawDeg);
  }

  loadUrl(url) {
    // Keep the procedural gallery on screen until the first video frame has
    // actually decoded — never swap to a black, not-yet-decoded texture.
    this._sourceUrl = url;
    this.hasFirstFrame = false;
    this.isUsingRealVideo = false;
    this.isBuffering = false;
    this.isPlaying = false;
    this.currentTime = 0;
    this._pendingPlay = false;
    this._resumeOnGesture = false;
    this._detachGestureRetry();
    this.material.map = this.canvasTexture;
    this.material.needsUpdate = true;

    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }

    this.emit('loading', { url });
    this._resetPrebuffer();

    this.video.preload = 'auto';
    this.video.src = url;
    this.video.load();

    // Playback is deferred until `loadeddata` (first frame) fires; from that
    // point audio and picture start together on the same element/clock.
    this.play();
  }

  useProcedural(duration) {
    // Switch back to the procedural gallery fallback when a tour has no video.
    this._sourceUrl = '';
    this._pendingPlay = false;
    this._resumeOnGesture = false;
    this._detachGestureRetry();
    this._resetPrebuffer();
    this.hasFirstFrame = false;
    this.isBuffering = false;
    this.isUsingRealVideo = false;
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    this.material.map = this.canvasTexture;
    this.material.needsUpdate = true;
    if (duration) this.duration = duration;
    this.currentTime = 0;
    this.isPlaying = true;
    this.emit('play');
  }

  play() {
    this.isPlaying = true;
    if (this._prebufferState === 'buffering') {
      // User pressed play during the warm-up — start immediately.
      this._finishPrebuffer();
      return;
    }
    if (this._sourceUrl && !this.hasFirstFrame) {
      // Source still loading — autostart the moment the first frame decodes.
      this._pendingPlay = true;
      this._resumeOnGesture = false;
      this.emit('play');
      return;
    }
    if (this.isUsingRealVideo) {
      this._startPlayback();
    } else {
      this.emit('play');
    }
  }

  pause() {
    if (this._prebufferState === 'buffering') return; // still warming the cache
    this.isPlaying = false;
    this._pendingPlay = false;
    this._resumeOnGesture = false;
    this._detachGestureRetry();
    if (this.isUsingRealVideo) {
      this.video.pause();
    } else {
      this.emit('pause');
    }
  }

  togglePlay() {
    if (this._prebufferState === 'buffering') {
      // Play request during warm-up = skip the intro and play now.
      this._finishPrebuffer();
      return;
    }
    if (this.isUsingRealVideo) {
      // HTMLVideoElement.paused is the authoritative source of truth,
      // so the toggle stays correct even while the video is buffering.
      if (this.video.paused) {
        this.play();
      } else {
        this.pause();
      }
    } else if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(seconds) {
    if (this._prebufferState === 'buffering') return; // ignore during warm-up
    const clamped = Math.max(0, Math.min(seconds, this.duration));
    this.currentTime = clamped;
    if (this.isUsingRealVideo) {
      this.video.currentTime = clamped;
    } else {
      this.emit('timeupdate', {
        currentTime: this.currentTime,
        duration: this.duration
      });
    }
  }

  setVolume(val) {
    if (!this.video) return;
    const v = Math.max(0, Math.min(val, 1));
    this.video.volume = v;
    this.video.muted = v === 0;
  }

  isMuted() {
    return this.video ? this.video.muted : false;
  }

  setMuted(muted) {
    if (!this.video) return;
    if (!muted && this.video.volume === 0) {
      this.video.volume = 0.8;
    }
    this.video.muted = muted;
  }

  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }

  update(delta) {
    // Simulated timeline only in procedural mode. While a real video source
    // is still loading (`_sourceUrl` set) we must NOT fabricate time — the
    // HUD/hotspots would run ahead of a video that hasn't started yet.
    if (!this.isUsingRealVideo && !this._sourceUrl && this.isPlaying) {
      this.currentTime += delta;
      if (this.currentTime >= this.duration) {
        this.currentTime = 0; // loop
      }
      this.emit('timeupdate', {
        currentTime: this.currentTime,
        duration: this.duration
      });
    }
  }
}

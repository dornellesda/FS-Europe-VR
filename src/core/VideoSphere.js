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
      error: []
    };

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
      this.emit('loadedmetadata', { duration: this.duration });
    });

    // First decodable frame is buffered — only now swap the gallery for the
    // VideoTexture, so the sphere is never black while the file downloads.
    this.video.addEventListener('loadeddata', () => {
      this._activateVideoTexture();
    });

    this.video.addEventListener('timeupdate', () => {
      if (this.isUsingRealVideo) {
        this._emitTime();
      }
    });

    this.video.addEventListener('seeked', () => {
      if (this.isUsingRealVideo) {
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
      // initial play() raced the loader) — nudge it back.
      if (this.isPlaying && this.video.paused && this.hasFirstFrame) {
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
      this._startPlayback();
    }
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
      this._emitTime();
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

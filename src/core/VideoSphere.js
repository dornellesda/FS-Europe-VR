import * as THREE from 'three';
import { createProcedural360Canvas } from '../utils/proceduralGallery.js';

export class VideoSphere {
  constructor(scene) {
    this.scene = scene;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 120; // Default 2-minute simulated duration for demo
    this.isUsingRealVideo = false;
    this.listeners = {
      timeupdate: [],
      play: [],
      pause: [],
      loadedmetadata: []
    };

    // Create hidden HTML5 video element
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.playsInline = true;
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.preload = 'auto';
    this.video.loop = true;
    this.video.style.display = 'none';
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
      this.duration = this.video.duration || 120;
      this.emit('loadedmetadata', { duration: this.duration });
    });

    this.video.addEventListener('timeupdate', () => {
      if (this.isUsingRealVideo) {
        this.currentTime = this.video.currentTime;
        this.emit('timeupdate', {
          currentTime: this.currentTime,
          duration: this.duration
        });
      }
    });

    this.video.addEventListener('play', () => {
      this.isPlaying = true;
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
    this.video.src = url;
    this.video.load();

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

    this.play();
  }

  useProcedural(duration) {
    // Switch back to the procedural gallery fallback when a tour has no video.
    if (this.isUsingRealVideo) this.video.pause();
    this.isUsingRealVideo = false;
    this.material.map = this.canvasTexture;
    this.material.needsUpdate = true;
    if (duration) this.duration = duration;
    this.currentTime = 0;
    this.isPlaying = true;
    this.emit('play');
  }

  play() {
    this.isPlaying = true;
    if (this.isUsingRealVideo) {
      this.video.play().catch((err) => {
        console.warn('Autoplay blocked, user interaction required:', err);
        this.isPlaying = false;
        this.emit('pause');
      });
    } else {
      this.emit('play');
    }
  }

  pause() {
    this.isPlaying = false;
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
    // If running in simulated procedural mode and is playing, increment simulated time
    if (!this.isUsingRealVideo && this.isPlaying) {
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

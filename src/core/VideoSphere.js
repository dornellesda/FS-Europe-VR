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

    // Custom shader material for precise colour grading without tone mapping.
    // Contrast and saturation are applied in the fragment shader.
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: this.canvasTexture },
        contrast:   { value: 1.05 },  // 1.0 = neutral, > 1.0 = more contrast
        saturation: { value: 1.10 },  // 1.0 = neutral, > 1.0 = more vivid
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float contrast;
        uniform float saturation;
        varying vec2 vUv;

        vec3 applySaturation(vec3 color, float sat) {
          // Luminance weights (ITU-R BT.709)
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(luma), color, sat);
        }

        vec3 applyContrast(vec3 color, float con) {
          // Pivot at 0.5 midpoint
          return (color - 0.5) * con + 0.5;
        }

        void main() {
          vec4 tex = texture2D(map, vUv);
          vec3 color = tex.rgb;
          color = applyContrast(color, contrast);
          color = applySaturation(color, saturation);
          gl_FragColor = vec4(clamp(color, 0.0, 1.0), tex.a);
        }
      `,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, 0);
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

    this.material.uniforms.map.value = this.videoTexture;
    this.material.needsUpdate = true;
    this.isUsingRealVideo = true;

    this.play();
  }

  play() {
    this.isPlaying = true;
    if (this.isUsingRealVideo) {
      this.video.play().catch((err) => {
        console.warn('Autoplay blocked, user interaction required:', err);
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
    if (this.isPlaying) {
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
    this.video.volume = Math.max(0, Math.min(val, 1));
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

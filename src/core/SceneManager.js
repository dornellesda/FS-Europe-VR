import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.updatables = [];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 0); // Average eye-level height (1.6m) in VR

    // WebGL Renderer with WebXR enabled
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    // NoToneMapping = video renders exactly as encoded, no cinematic processing.
    // ACES/Filmic tone mapping is designed for synthetic 3D scenes and over-exposes
    // real-world 360° video footage, blowing out highlights.
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.container.appendChild(this.renderer.domElement);

    // Setup Lighting
    this.setupLighting();

    // Setup VR Button
    this.setupVR();

    // Clock for delta timing
    this.clock = new THREE.Clock();

    // Handle Window Resize
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Start WebXR compatible animation loop
    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe0e7ff, 1.5);
    dirLight.position.set(2, 6, 3);
    this.scene.add(dirLight);

    const softFillLight = new THREE.DirectionalLight(0x87b940, 0.6);
    softFillLight.position.set(-3, -2, -2);
    this.scene.add(softFillLight);
  }

  setupVR() {
    // VR Button placed by Three.js
    const vrBtn = VRButton.createButton(this.renderer);
    vrBtn.id = 'vr-button-element';
    vrBtn.classList.add('custom-vr-btn');

    // Remove Three.js inline conflicting position styles
    vrBtn.style.left = 'auto';
    vrBtn.style.width = 'auto';

    // If on a regular desktop screen, clarify that it's playable on desktop & VR ready on headset
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (!supported) {
          vrBtn.innerHTML = '<span>🥽 VR Mode</span><span class="vr-btn-sub">Open in Quest</span>';
          vrBtn.title = 'Immersive VR is ready! Open this URL inside your Meta Quest browser to enter VR with 6DoF controllers.';
          vrBtn.classList.add('desktop-preview-badge');
        }
      }).catch(() => {});
    } else {
      vrBtn.innerHTML = '<span>🥽 VR Mode</span><span class="vr-btn-sub">Open in Quest</span>';
      vrBtn.title = 'Immersive VR is ready! Open this URL inside your Meta Quest browser to enter VR with 6DoF controllers.';
      vrBtn.classList.add('desktop-preview-badge');
    }

    document.body.appendChild(vrBtn);

    // Track VR session state
    this.isInVR = false;
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isInVR = true;
      document.body.classList.add('in-vr-session');
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this.isInVR = false;
      document.body.classList.remove('in-vr-session');
    });
  }

  registerUpdatable(obj) {
    this.updatables.push(obj);
  }

  unregisterUpdatable(obj) {
    const idx = this.updatables.indexOf(obj);
    if (idx !== -1) {
      this.updatables.splice(idx, 1);
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(time, frame) {
    const delta = this.clock.getDelta();

    // Update all registered components (hotspots, controllers, video sphere)
    for (let i = 0; i < this.updatables.length; i++) {
      if (this.updatables[i].update) {
        this.updatables[i].update(delta, time, frame);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

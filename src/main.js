import { tourStore } from './config/tourStore.js';
import { SceneManager } from './core/SceneManager.js';
import { VideoSphere } from './core/VideoSphere.js';
import { XRControllerManager } from './core/XRControllerManager.js';
import { InputManager } from './core/InputManager.js';
import { HotspotManager } from './interactive/HotspotManager.js';
import { ExhibitModal } from './interactive/ExhibitModal.js';
import { QRCodeLinkModal } from './interactive/QRCodeLinkModal.js';
import { VideoPopupModal } from './interactive/VideoPopupModal.js';
import { VideoHUD } from './ui/VideoHUD.js';
import { CalibrationOverlay } from './ui/CalibrationOverlay.js';
import { TourCatalogModal } from './ui/TourCatalogModal.js';
import { AdminHub } from './ui/AdminHub.js';
import { AuthModal } from './ui/AuthModal.js';

class WebXRExhibitApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.init();
  }

  init() {
    const activeTour = tourStore.getActiveTour();

    // 1. Initialize Three.js WebXR Scene & Renderer
    this.sceneManager = new SceneManager(this.container);

    // 2. Initialize 360 Video Sphere
    this.videoSphere = new VideoSphere(this.sceneManager.scene);
    this.sceneManager.registerUpdatable(this.videoSphere);

    // 3. Initialize VR Controllers & Raycaster
    this.xrControllerManager = new XRControllerManager(
      this.sceneManager.renderer,
      this.sceneManager.scene
    );
    this.sceneManager.registerUpdatable(this.xrControllerManager);

    // 4. Initialize Desktop & Touch Orbit Controls
    this.inputManager = new InputManager(
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement,
      this.sceneManager
    );
    this.sceneManager.registerUpdatable(this.inputManager);

    // 5. Initialize Modals
    const resumeCallback = () => {
      this.videoSphere.play();
    };

    this.exhibitModal = new ExhibitModal(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.xrControllerManager,
      this.inputManager,
      resumeCallback
    );
    this.sceneManager.registerUpdatable(this.exhibitModal);

    this.qrModal = new QRCodeLinkModal(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.xrControllerManager,
      this.inputManager,
      resumeCallback
    );

    this.videoPopupModal = new VideoPopupModal(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.xrControllerManager,
      this.inputManager,
      resumeCallback
    );
    this.sceneManager.registerUpdatable(this.videoPopupModal);

    // 6. Initialize Hotspot Manager with current tour's hotspots
    this.hotspotManager = new HotspotManager(
      this.sceneManager.scene,
      this.sceneManager.camera,
      activeTour.hotspots || [],
      (hotspot) => this.handleHotspotTrigger(hotspot)
    );
    this.sceneManager.registerUpdatable(this.hotspotManager);

    this.syncInteractiveMeshes();

    // Sync hotspots visibility whenever video time updates
    this.videoSphere.addEventListener('timeupdate', (data) => {
      this.hotspotManager.syncWithTime(data.currentTime);
    });

    // 7. Initialize Calibration Tool Overlay
    this.calibrationOverlay = new CalibrationOverlay(
      this.inputManager,
      this.videoSphere
    );
    this.sceneManager.registerUpdatable(this.calibrationOverlay);

    // 8. Initialize Admin Hub & Tour Catalog Modal
    this.adminHub = new AdminHub(
      this.inputManager,
      this.videoSphere,
      (updatedTour) => {
        this.switchTour(updatedTour);
      }
    );

    // Initialize Auth Modal for protecting Admin Hub
    this.authModal = new AuthModal(() => {
      this.adminHub.open();
    });

    this.tourCatalog = new TourCatalogModal(
      (selectedTour) => {
        this.switchTour(selectedTour);
      },
      () => {
        this.adminHub.open();
      }
    );

    // 9. Initialize Video HUD
    this.videoHUD = new VideoHUD(this.videoSphere, activeTour, {
      onOpenCatalog: () => this.tourCatalog.open(),
      onOpenAdmin: () => this.authModal.open(),
      onToggleCalib: () => this.calibrationOverlay.toggle()
    });

    // Keyboard shortcut for Admin Hub: 'KeyA'
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'KeyA') {
        if (this.adminHub.container.classList.contains('open')) {
          this.adminHub.close();
        } else {
          this.authModal.open();
        }
      }
    });

    // Control video from custom events emitted by InputManager
    window.addEventListener('exhibit-toggle-play', () => {
      this.videoSphere.togglePlay();
    });

    window.addEventListener('exhibit-seek-relative', (e) => {
      const delta = e.detail;
      this.videoSphere.seek(this.videoSphere.currentTime + delta);
    });


    // 10. Load Initial Tour Media
    this.applyTourMedia(activeTour);

    // 11. Check for admin URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('admin') || window.location.pathname.includes('/admin')) {
      setTimeout(() => this.authModal.open(), 500);
    }

    // Subscribe to store updates (e.g. when DB finishes loading)
    tourStore.subscribe((tours, activeTour) => {
      this.switchTour(activeTour);
    });

    console.log('FamilySearch Europe VR Initialized Successfully');
  }

  syncInteractiveMeshes() {
    const hotspotMeshes = this.hotspotManager.getInteractiveMeshes();
    this.xrControllerManager.setInteractiveObjects(hotspotMeshes);
    this.inputManager.setInteractiveObjects(hotspotMeshes);
  }

  switchTour(tour) {
    if (!tour) return;
    console.log('[Tour Switcher] Switching to tour:', tour.title);

    // 1. Update Hotspots
    this.hotspotManager.setHotspotsData(tour.hotspots || []);
    this.syncInteractiveMeshes();

    // 2. Update HUD
    this.videoHUD.setTour(tour);

    // 3. Load 360 Video Source
    this.applyTourMedia(tour);
  }

  applyTourMedia(tour) {
    if (tour.videoSrc && tour.videoSrc.trim() !== '') {
      this.videoSphere.loadUrl(tour.videoSrc);
    } else {
      // Procedural Gallery simulation with timeline duration
      this.videoSphere.duration = tour.duration || 120;
      this.videoSphere.play();
    }
  }

  handleHotspotTrigger(hotspot) {
    // Pause tour video while user explores interactive experience
    this.videoSphere.pause();

    if (hotspot.type === 'interactive-exhibit') {
      this.exhibitModal.open(hotspot);
    } else if (hotspot.type === 'video-popup') {
      this.videoPopupModal.open(hotspot);
    } else if (hotspot.type === 'qr-code') {
      this.qrModal.open(hotspot);
    }
  }
}

// Start application when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new WebXRExhibitApp();
});

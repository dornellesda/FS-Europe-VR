import { tourStore } from './config/tourStore.js';
import { supabase } from './config/supabaseClient.js';
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
import { PrebufferOverlay } from './ui/PrebufferOverlay.js';
import { TourCatalogModal } from './ui/TourCatalogModal.js';
import { AdminHub } from './ui/AdminHub.js';
import { AuthModal } from './ui/AuthModal.js';

class WebXRExhibitApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.init();
  }

  init() {
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

    // 6. Initialize Hotspot Manager — populated once DB hydration settles.
    this.hotspotManager = new HotspotManager(
      this.sceneManager.scene,
      this.sceneManager.camera,
      [],
      (hotspot) => this.handleHotspotTrigger(hotspot)
    );
    this.sceneManager.registerUpdatable(this.hotspotManager);

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

    // Shared auth-gated function used by ALL entry points to the Admin Hub
    this._openAdminGated = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          this.adminHub.open();
          return;
        }
      }
      // No session or Supabase not configured — show login modal
      this.authModal.open();
    };

    this.tourCatalog = new TourCatalogModal(
      (selectedTour) => {
        this.switchTour(selectedTour);
      },
      () => {
        this._openAdminGated();
      }
    );

    // 9. Initialize Video HUD — tour data is applied after DB hydration
    this.videoHUD = new VideoHUD(this.videoSphere, null, {
      onOpenCatalog: () => this.tourCatalog.open(),
      onOpenAdmin: () => this._openAdminGated(),
      onToggleCalib: () => this.calibrationOverlay.toggle()
    });

    // 9b. No-pause intro: fun animation shown while the 360 file is pre-buffered
    this.prebufferOverlay = new PrebufferOverlay(this.videoSphere);

    // Keyboard shortcut for Admin Hub: 'KeyA'
    window.addEventListener('keydown', async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'KeyA') {
        if (this.adminHub.container.classList.contains('open')) {
          this.adminHub.close();
        } else {
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              this.adminHub.open();
              return;
            }
          }
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


    // 10. Check for admin URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('admin') || window.location.pathname.includes('/admin')) {
      setTimeout(async () => {
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            this.adminHub.open();
            return;
          }
        }
        this.authModal.open();
      }, 500);
    }

    // Subscribe to store updates (e.g. when DB finishes loading or admin edits)
    tourStore.subscribe((tours, activeTour) => {
      if (!tourStore.isHydrated) return; // never render seed data mid-hydration
      this.switchTour(activeTour);
    });

    // 10. Load the real tour catalog as soon as Supabase hydration settles
    this.bootstrapTour().catch((err) => {
      console.error('Tour bootstrap failed:', err);
    });

    // Rotate the 3D world on VR entry so the headset user starts facing
    // the tour's authored startPOV (yaw); restore on session end.
    window.addEventListener('exhibit-session-start', () => {
      const tour = tourStore.getActiveTour();
      const yaw = tour?.startPOV?.yaw;
      if (typeof yaw === 'number') {
        this.videoSphere.setPanoRotationY(yaw);
        this.hotspotManager.applyWorldRotationY(yaw);
      }
    });
    window.addEventListener('exhibit-session-end', () => {
      this.videoSphere.setPanoRotationY(0);
      this.hotspotManager.applyWorldRotationY(0);
    });

    console.log('FamilySearch Europe VR Initialized Successfully');
  }

  /**
   * Waits for the tour catalog to hydrate from Supabase, then wires every
   * tour-dependent UI (hotspots, HUD, 360 video, start POV). Until this runs
   * the scene is neutral — no seed/demo data is ever shown as real content.
   */
  async bootstrapTour() {
    const store = await tourStore.ready;
    const tour = store.getActiveTour();
    if (!tour) {
      console.warn('[Bootstrap] No active tour available after hydration.');
      return;
    }
    console.log(`[Bootstrap] Tour catalog hydrated from ${store.hydrationStatus === 'ready' ? 'database' : store.hydrationStatus + ' (demo data)'}:`, tour.title);

    this.hotspotManager.setHotspotsData(tour.hotspots || []);
    this.syncInteractiveMeshes();
    this.videoHUD.setTour(tour);
    this.applyTourMedia(tour);
    this.applyStartPOV(tour);
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

    // 4. Orient initial camera toward the tour's configured start POV
    this.applyStartPOV(tour);

    // 4b. In an active VR session, rotate the world so the new tour also
    // starts facing its authored startPOV (headset users don't use lon/lat).
    if (this.sceneManager.isInVR) {
      const yaw = tour?.startPOV?.yaw;
      if (typeof yaw === 'number') {
        this.videoSphere.setPanoRotationY(yaw);
        this.hotspotManager.applyWorldRotationY(yaw);
      } else {
        this.videoSphere.setPanoRotationY(0);
        this.hotspotManager.applyWorldRotationY(0);
      }
    }
  }

  applyStartPOV(tour) {
    if (tour?.startPOV && this.inputManager) {
      this.inputManager.setStartPOV(tour.startPOV.yaw || 0, tour.startPOV.pitch || 0);
    }
  }

  applyTourMedia(tour) {
    if (tour.videoSrc && tour.videoSrc.trim() !== '') {
      this.videoSphere.loadUrl(tour.videoSrc);
    } else {
      // Procedural Gallery simulation with timeline duration
      this.videoSphere.useProcedural(tour.duration || 120);
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

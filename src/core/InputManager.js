import * as THREE from 'three';

export class InputManager {
  constructor(camera, domElement, sceneManager) {
    this.camera = camera;
    this.domElement = domElement;
    this.sceneManager = sceneManager;

    this.isUserInteracting = false;
    this.onPointerDownPointerX = 0;
    this.onPointerDownPointerY = 0;
    this.lon = 0;
    this.lat = 0;
    this.isPinningMode = false;
    this.onPointerDownLon = 0;
    this.onPointerDownLat = 0;
    this.phi = 0;
    this.theta = 0;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactiveObjects = [];
    this.hoveredObject = null;

    this.setupMouseEvents();
    this.setupKeyboardEvents();

    window.addEventListener('exhibit-toggle-pinning', (e) => {
      this.isPinningMode = e.detail.active;
      if (this.isPinningMode) {
        this.domElement.style.cursor = 'crosshair';
      } else {
        this.domElement.style.cursor = 'default';
      }
    });
  }

  setInteractiveObjects(objects) {
    this.interactiveObjects = objects;
  }

  addInteractiveObject(obj) {
    if (!this.interactiveObjects.includes(obj)) {
      this.interactiveObjects.push(obj);
    }
  }

  removeInteractiveObject(obj) {
    const index = this.interactiveObjects.indexOf(obj);
    if (index !== -1) {
      this.interactiveObjects.splice(index, 1);
    }
  }

  setupMouseEvents() {
    this.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.domElement.addEventListener('click', this.onClick.bind(this));
    this.domElement.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
  }

  setupKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      // Avoid capturing shortcuts if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('exhibit-toggle-play'));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('exhibit-seek-relative', { detail: 10 }));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('exhibit-seek-relative', { detail: -10 }));
      } else if (e.key === 'c' || e.key === 'C') {
        window.dispatchEvent(new CustomEvent('exhibit-toggle-calibration'));
      }
    });
  }

  onPointerDown(event) {
    // Only handle primary button
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    this.isUserInteracting = true;
    this.hasMovedSignificantly = false;
    this.onPointerDownPointerX = event.clientX;
    this.onPointerDownPointerY = event.clientY;
    this.onPointerDownLon = this.lon;
    this.onPointerDownLat = this.lat;
  }

  onPointerMove(event) {
    // Update normalized mouse coordinates for raycasting
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this.isUserInteracting && !this.sceneManager.isInVR) {
      const deltaX = event.clientX - this.onPointerDownPointerX;
      const deltaY = event.clientY - this.onPointerDownPointerY;

      if (Math.hypot(deltaX, deltaY) > 5) {
        this.hasMovedSignificantly = true;
      }

      this.lon = (this.onPointerDownPointerX - event.clientX) * 0.15 + this.onPointerDownLon;
      this.lat = (event.clientY - this.onPointerDownPointerY) * 0.15 + this.onPointerDownLat;
      this.lat = Math.max(-85, Math.min(85, this.lat));
    }

    this.checkHover();
  }

  onPointerUp() {
    this.isUserInteracting = false;
  }

  onWheel(event) {
    if (this.sceneManager.isInVR) return;
    
    // Only zoom if the user is pointing inside the canvas to prevent zooming the page unexpectedly
    if (event.target !== this.domElement && !this.domElement.contains(event.target)) return;

    // Zoom in/out by changing the camera's FOV
    const zoomSpeed = 0.05;
    this.camera.fov += event.deltaY * zoomSpeed;
    
    // Clamp the FOV between 20 (zoomed in) and 100 (zoomed out)
    this.camera.fov = Math.max(20, Math.min(100, this.camera.fov));
    this.camera.updateProjectionMatrix();
    
    // Prevent default scrolling on the page when zooming
    event.preventDefault();
  }

  onClick(event) {
    // Ignore click if user was dragging to rotate camera
    if (this.hasMovedSignificantly) return;
    if (this.sceneManager.isInVR) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    if (this.isPinningMode) {
      const dir = this.raycaster.ray.direction;
      const pitch = Math.asin(dir.y) * (180 / Math.PI);
      const yaw = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);
      
      window.dispatchEvent(new CustomEvent('exhibit-pin-placed', {
        detail: { pitch: pitch.toFixed(1), yaw: yaw.toFixed(1) }
      }));
      return;
    }

    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target && !target.userData.onClick && target.parent) {
        target = target.parent;
      }
      if (target && target.userData.onClick) {
        target.userData.onClick(intersects[0]);
      }
    }
  }

  checkHover() {
    if (this.sceneManager.isInVR) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    let newlyHovered = null;
    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target && !target.userData.onHover && target.parent) {
        target = target.parent;
      }
      if (target) newlyHovered = target;
    }

    if (newlyHovered !== this.hoveredObject) {
      if (this.hoveredObject && this.hoveredObject.userData.onHoverEnd) {
        this.hoveredObject.userData.onHoverEnd();
      }
      this.hoveredObject = newlyHovered;
      if (this.hoveredObject && this.hoveredObject.userData.onHover) {
        this.hoveredObject.userData.onHover();
        this.domElement.style.cursor = 'pointer';
      } else {
        if (!this.isPinningMode) {
          this.domElement.style.cursor = 'default';
        }
      }
    }
  }

  /**
   * Returns current camera Pitch (lat) and Yaw (lon) in degrees (-180 to 180)
   */
  getCurrentAngles() {
    if (this.sceneManager.isInVR) {
      // In VR, calculate yaw and pitch directly from camera world direction
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const pitch = Math.asin(dir.y) * (180 / Math.PI);
      const yaw = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);
      return { pitch: pitch.toFixed(1), yaw: yaw.toFixed(1) };
    } else {
      // In Desktop mode, calculate from lon/lat
      let normalizedLon = (this.lon % 360);
      if (normalizedLon > 180) normalizedLon -= 360;
      if (normalizedLon < -180) normalizedLon += 360;
      return {
        pitch: this.lat.toFixed(1),
        yaw: normalizedLon.toFixed(1)
      };
    }
  }

  update(delta) {
    if (!this.sceneManager.isInVR) {
      this.phi = THREE.MathUtils.degToRad(90 - this.lat);
      this.theta = THREE.MathUtils.degToRad(this.lon);

      const target = new THREE.Vector3();
      target.x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
      target.y = 500 * Math.cos(this.phi);
      target.z = 500 * Math.sin(this.phi) * Math.sin(this.theta);

      this.camera.lookAt(target);
    }
  }
}

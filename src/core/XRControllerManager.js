import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class XRControllerManager {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.controllers = [];
    this.controllerGrips = [];
    this.raycaster = new THREE.Raycaster();
    this.interactiveObjects = [];
    this.hoveredObject = null;

    this.setupControllers();
  }

  setupControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
      // Controller Ray & Input
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', this.onSelectStart.bind(this, i));
      controller.addEventListener('selectend', this.onSelectEnd.bind(this, i));
      controller.addEventListener('connected', (e) => {
        controller.userData.targetRayMode = e.data.targetRayMode;
        controller.userData.gamepad = e.data.gamepad;
      });
      this.scene.add(controller);
      this.controllers.push(controller);

      // Visual Laser Beam
      const beamGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3)
      ]);
      const beamMat = new THREE.LineBasicMaterial({
        color: 0x87b940,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      const beam = new THREE.Line(beamGeom, beamMat);
      beam.name = 'laserBeam';
      controller.add(beam);

      // Reticle Cursor at beam tip
      const reticleGeom = new THREE.RingGeometry(0.015, 0.025, 24);
      const reticleMat = new THREE.MeshBasicMaterial({
        color: 0x87b940,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const reticle = new THREE.Mesh(reticleGeom, reticleMat);
      reticle.position.set(0, 0, -3);
      reticle.name = 'reticle';
      controller.add(reticle);

      // Controller Grip Model
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);
    }
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

  onSelectStart(controllerIndex) {
    const controller = this.controllers[controllerIndex];
    if (!controller) return;

    this.triggerHaptic(controllerIndex, 0.6, 60);

    const intersection = this.getControllerIntersection(controller);
    if (intersection && intersection.object) {
      let target = intersection.object;
      while (target && !target.userData.onClick && target.parent) {
        target = target.parent;
      }
      if (target && target.userData.onClick) {
        target.userData.onClick(intersection);
      }
    }
  }

  onSelectEnd(controllerIndex) {
    // Handled if needed for release actions
  }

  triggerHaptic(controllerIndex, intensity = 0.5, durationMs = 40) {
    const controller = this.controllers[controllerIndex];
    if (controller && controller.userData && controller.userData.gamepad) {
      const actuators = controller.userData.gamepad.hapticActuators;
      if (actuators && actuators.length > 0) {
        actuators[0].pulse(intensity, durationMs);
      }
    }
  }

  getControllerIntersection(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = this.raycaster.intersectObjects(
      this.interactiveObjects.filter((o) => o.visible !== false),
      true
    );
    return intersects.length > 0 ? intersects[0] : null;
  }

  update(delta) {
    // Perform raycasting for each active VR controller
    let newlyHovered = null;

    for (let i = 0; i < this.controllers.length; i++) {
      const controller = this.controllers[i];
      if (!controller.visible) continue;

      const beam = controller.getObjectByName('laserBeam');
      const reticle = controller.getObjectByName('reticle');

      const intersection = this.getControllerIntersection(controller);
      if (intersection) {
        const hitDistance = intersection.distance;
        if (beam) beam.scale.z = hitDistance / 3;
        if (reticle) reticle.position.z = -hitDistance;

        let target = intersection.object;
        while (target && !target.userData.onHover && target.parent) {
          target = target.parent;
        }
        if (target) newlyHovered = target;
      } else {
        if (beam) beam.scale.z = 1;
        if (reticle) reticle.position.z = -3;
      }
    }

    // Hover state management
    if (newlyHovered !== this.hoveredObject) {
      if (this.hoveredObject && this.hoveredObject.userData.onHoverEnd) {
        this.hoveredObject.userData.onHoverEnd();
      }
      this.hoveredObject = newlyHovered;
      if (this.hoveredObject && this.hoveredObject.userData.onHover) {
        this.hoveredObject.userData.onHover();
        this.triggerHaptic(0, 0.2, 20);
      }
    }
  }
}

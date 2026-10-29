import { quat, utils, vec3 } from "pex-math";
import { CameraType, KeyboardManager, PointerManager } from "cameras";

import type { Quat, Vec3 } from "pex-math";
import type { InteractiveArea, Lens } from "cameras";
import type {
  CameraComponentOptions,
  Controls,
  ControlsComponentOptions,
  Entity,
  EntityId,
  SystemOptions,
  SystemUpdateOptions,
  TransformComponentOptions,
} from "../types.js";

interface ControlsCache {
  component: ControlsComponentOptions;
  controls: Controls;
  pointer: PointerManager;
  keyboard: KeyboardManager | null;
  settings: Record<string, unknown>;
  /** Last pose written, to tell external edits apart. */
  position: Vec3;
  rotation: Quat;
  zoom: number;
}

// Place or wire the controller rather than configure it: read at creation only.
const CREATION_KEYS = new Set([
  "controller",
  "element",
  "pointer",
  "keyboard",
  "bindings",
  "position",
  "target",
  "up",
]);

/** Deep for arrays, so in place edits of `distanceBounds` and such count. */
function isEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!isEqual(a[i], b[i])) return false;
  return true;
}

const copy = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(copy) : value;

/** Live lens view of a camera component, defaults applied. */
const createLens = (camera: CameraComponentOptions): Lens => ({
  get type() {
    return camera.projection === "orthographic"
      ? CameraType.Orthographic
      : CameraType.Perspective;
  },
  get aspect() {
    return camera.aspect!;
  },
  get fov() {
    return camera.fov!;
  },
  get size() {
    return camera.bounds
      ? Math.abs(camera.bounds[3] - camera.bounds[2]) / 2
      : camera.size!;
  },
  get near() {
    return camera.near!;
  },
  get far() {
    return camera.far!;
  },
});

// Steering controllers (first person, fly) have no target. Tested on the API
// rather than the class, so the system doesn't keep every controller bundled.
const hasTarget = (controls: Controls) => "getTarget" in controls;

function isMoved(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > utils.EPSILON) return true;
  }
  return false;
}

/** Camera viewport as a fraction of the canvas, where input is accepted. */
function viewportArea(
  out: InteractiveArea,
  camera: CameraComponentOptions,
  width: number,
  height: number,
): InteractiveArea {
  const { viewport } = camera;
  if (viewport) {
    out[0] = viewport[0] / width;
    out[1] = viewport[1] / height;
    out[2] = viewport[2] / width;
    out[3] = viewport[3] / height;
  } else {
    out[0] = out[1] = 0;
    out[2] = out[3] = 1;
  }
  return out;
}

/**
 * Controls system
 *
 * Runs before the transform system: writes the controller pose into
 * "transform.position", "transform.rotation" and "camera.zoom".
 *
 * Adds:
 *
 * - "_controls" to entities: the controller declared by the controls component
 */
export default ({ ctx }: SystemOptions) => ({
  type: "controls-system",
  cache: {} as Record<EntityId, ControlsCache>,
  debug: false,
  createControls(entity: Entity): ControlsCache {
    const component = entity.controls!;
    const camera = entity.camera!;
    const transform = entity.transform!;
    const { element, pointer, keyboard, position, target, up, bindings } =
      component;

    const settings: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(component)) {
      if (!CREATION_KEYS.has(key)) settings[key] = copy(value);
    }

    const Controller = component.controller as new (
      options: Record<string, unknown>,
    ) => Controls;
    const controls = new Controller({
      ...settings,
      lens: createLens(camera),
      bindings,
      up,
      target,
      position: position ?? transform.position,
    });

    // Steering controllers have no target to look at: without one, they look
    // where the camera does. Target controllers look at the origin.
    if (!target && !hasTarget(controls)) {
      controls.setPose(
        controls.getPosition(vec3.create(), true),
        transform.rotation!,
        false,
      );
    }
    // Zoom is not a controller option. Saved after it, so `reset` returns to
    // the camera as created rather than to the controller defaults.
    controls.zoomTo(camera.zoom!, false).saveState();

    const pointerManager = new PointerManager(
      element ?? (ctx.canvas as HTMLElement),
      pointer,
    ).enable();
    let keyboardManager: KeyboardManager | null = null;
    if (keyboard) {
      const { target = globalThis, ...keyboardOptions } = keyboard;
      keyboardManager = new KeyboardManager(target, keyboardOptions).enable();
    }
    controls.attach(pointerManager, keyboardManager);

    return {
      component,
      controls,
      pointer: pointerManager,
      keyboard: keyboardManager,
      settings,
      position: [...transform.position!],
      rotation: [...transform.rotation!],
      zoom: camera.zoom!,
    };
  },
  /**
   * Follow the camera viewport and canvas size, unless the component sets its
   * own `pointer.interactiveArea`.
   */
  updateInteractiveArea(cached: ControlsCache, camera: CameraComponentOptions) {
    if (cached.component.pointer?.interactiveArea) return;
    viewportArea(cached.pointer.interactiveArea, camera, ctx.width, ctx.height);
  },
  /**
   * Resync the controller to a camera edited outside of it: transform position
   * and rotation, or zoom.
   */
  syncExternalEdits(
    cached: ControlsCache,
    camera: CameraComponentOptions,
    position: Vec3,
    rotation: Quat,
  ) {
    const { controls } = cached;
    if (
      isMoved(position, cached.position) ||
      isMoved(rotation, cached.rotation)
    ) {
      controls.setPose(position, rotation, false);
    }
    if (camera.zoom !== cached.zoom) controls.zoomTo(camera.zoom!, false);
  },
  disposeControls(cached: ControlsCache) {
    cached.controls.dispose();
    cached.pointer.dispose();
    cached.keyboard?.dispose();
  },
  updateSettings(cached: ControlsCache) {
    const { component } = cached;
    let changed: Record<string, unknown> | undefined;
    for (const key in component) {
      const value: unknown = component[key as keyof typeof component];
      if (CREATION_KEYS.has(key) || isEqual(value, cached.settings[key])) {
        continue;
      }
      cached.settings[key] = copy(value);
      (changed ??= {})[key] = value;
    }
    if (changed) cached.controls.set(changed);
  },
  update(entities: Entity[], { deltaTime = 0 }: SystemUpdateOptions = {}) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      let cached = this.cache[entity.id];

      if (cached && cached.component !== entity.controls) {
        this.disposeControls(cached);
        delete this.cache[entity.id];
        delete entity._controls;
        cached = undefined;
      }
      if (!entity.controls || !entity.camera || !entity.transform) continue;

      const camera = entity.camera;
      const transform: TransformComponentOptions = entity.transform;
      const position = (transform.position ??= vec3.create());
      const rotation = (transform.rotation ??= quat.create());

      cached ??= this.cache[entity.id] = this.createControls(entity);
      entity._controls = cached.controls;
      const { controls } = cached;

      this.updateSettings(cached);
      this.updateInteractiveArea(cached, camera);
      this.syncExternalEdits(cached, camera, position, rotation);

      // Written only when the pose changed, so a controller at rest leaves the
      // transform clean.
      if (controls.update(deltaTime)) {
        const { pose } = controls;
        vec3.set(position, pose.position);
        quat.set(rotation, pose.orientation);
        transform.dirty = true;
        if (pose.zoom !== undefined) camera.zoom = pose.zoom;
      }
      vec3.set(cached.position, position);
      quat.set(cached.rotation, rotation);
      cached.zoom = camera.zoom!;
    }
  },
  dispose(entities?: Entity[]) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]!;
        const cached = this.cache[entity.id];
        if (!cached) continue;
        this.disposeControls(cached);
        delete this.cache[entity.id];
        delete entity._controls;
      }
    } else {
      for (const cached of Object.values(this.cache)) {
        this.disposeControls(cached);
      }
      this.cache = {};
    }
  },
});

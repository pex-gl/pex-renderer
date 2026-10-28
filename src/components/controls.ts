import {
  FirstPersonControls,
  FlyControls,
  MapControls,
  OrbitControls,
  TrackballControls,
} from "cameras";

import type {
  FirstPersonControlsComponentOptions,
  FlyControlsComponentOptions,
  MapControlsComponentOptions,
  OrbitControlsComponentOptions,
  TrackballControlsComponentOptions,
} from "../types.js";

// Separate exports, re-exported as a namespace: a bundle only keeps the
// controllers it calls a factory for.

/** Orbit controls component */
export const orbit = (
  options?: Partial<OrbitControlsComponentOptions>,
): OrbitControlsComponentOptions => ({ controller: OrbitControls, ...options });

/** Map controls component: orbit preset for top-down scenes. */
export const map = (
  options?: Partial<MapControlsComponentOptions>,
): MapControlsComponentOptions => ({ controller: MapControls, ...options });

/** Trackball controls component */
export const trackball = (
  options?: Partial<TrackballControlsComponentOptions>,
): TrackballControlsComponentOptions => ({
  controller: TrackballControls,
  ...options,
});

/** First person controls component */
export const firstPerson = (
  options?: Partial<FirstPersonControlsComponentOptions>,
): FirstPersonControlsComponentOptions => ({
  controller: FirstPersonControls,
  keyboard: {},
  ...options,
});

/** Fly controls component */
export const fly = (
  options?: Partial<FlyControlsComponentOptions>,
): FlyControlsComponentOptions => ({
  controller: FlyControls,
  keyboard: {},
  ...options,
});

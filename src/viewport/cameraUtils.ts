/**
 * Camera positioning utilities for the 3D viewport.
 *
 * Calculates optimal camera position to frame the workpiece.
 */

import type { WorkpieceDimensions } from '../parser/types'

export interface CameraPosition {
  x: number
  y: number
  z: number
}

export interface CameraTarget {
  x: number
  y: number
  z: number
}

/**
 * Calculate camera position to frame a workpiece with the given dimensions.
 * Positions camera at a 45-degree elevation looking at the workpiece center.
 */
export function calculateCameraPosition(dimensions: WorkpieceDimensions): {
  position: CameraPosition
  target: CameraTarget
} {
  const { width, height, thickness } = dimensions

  // Target: center of workpiece
  const target: CameraTarget = {
    x: width / 2,
    y: height / 2,
    z: -thickness / 2,
  }

  // Distance: enough to see the full workpiece with some margin
  const maxDimension = Math.max(width, height, thickness)
  const distance = maxDimension * 1.5

  // Position: elevated view from front-right
  const position: CameraPosition = {
    x: width / 2 + distance * 0.6,
    y: height / 2 - distance * 0.4,
    z: distance * 0.5,
  }

  return { position, target }
}

/**
 * Default camera position for when no workpiece is loaded.
 */
export const DEFAULT_CAMERA_POSITION: CameraPosition = { x: 600, y: -400, z: 300 }
export const DEFAULT_CAMERA_TARGET: CameraTarget = { x: 200, y: 200, z: 0 }

/** Available camera view presets */
export type ViewPreset = 'perspective' | 'top' | 'bottom' | 'front' | 'back' | 'right' | 'left'

export interface ViewPresetConfig {
  label: string
  type: 'perspective' | 'orthographic'
  /** Position offset relative to workpiece center, scaled by distance */
  offset: CameraPosition
  /** Camera up vector */
  up: CameraPosition
}

export const VIEW_PRESETS: Record<ViewPreset, ViewPresetConfig> = {
  perspective: {
    label: '3D',
    type: 'perspective',
    offset: { x: 0.6, y: -0.4, z: 0.5 },
    up: { x: 0, y: 0, z: 1 },
  },
  top: {
    label: 'Top',
    type: 'orthographic',
    offset: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
  },
  bottom: {
    label: 'Bottom',
    type: 'orthographic',
    offset: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: -1, z: 0 },
  },
  front: {
    label: 'Front',
    type: 'orthographic',
    offset: { x: 0, y: -1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
  back: {
    label: 'Back',
    type: 'orthographic',
    offset: { x: 0, y: 1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
  right: {
    label: 'Right',
    type: 'orthographic',
    offset: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
  left: {
    label: 'Left',
    type: 'orthographic',
    offset: { x: -1, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
}

/**
 * Calculate camera setup for a specific view preset.
 */
export function calculatePresetCamera(
  preset: ViewPreset,
  dimensions: WorkpieceDimensions,
): {
  position: CameraPosition
  target: CameraTarget
  up: CameraPosition
  isOrthographic: boolean
  orthoSize: number
} {
  const config = VIEW_PRESETS[preset]
  const { width, height, thickness } = dimensions

  const target: CameraTarget = {
    x: width / 2,
    y: height / 2,
    z: -thickness / 2,
  }

  const maxDimension = Math.max(width, height, thickness)
  const distance = maxDimension * 1.5

  const position: CameraPosition = {
    x: target.x + config.offset.x * distance,
    y: target.y + config.offset.y * distance,
    z: target.z + config.offset.z * distance,
  }

  // Ortho size: fit the larger visible dimension with some margin
  const orthoSize = maxDimension * 0.7

  return {
    position,
    target,
    up: config.up,
    isOrthographic: config.type === 'orthographic',
    orthoSize,
  }
}

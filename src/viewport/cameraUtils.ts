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

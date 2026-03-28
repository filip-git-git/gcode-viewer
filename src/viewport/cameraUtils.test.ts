import { describe, it, expect } from 'vitest'
import {
  calculateCameraPosition,
  calculatePresetCamera,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  VIEW_PRESETS,
  type ViewPreset,
} from './cameraUtils'

describe('calculateCameraPosition', () => {
  it('centers target on workpiece', () => {
    const { target } = calculateCameraPosition({ width: 800, height: 500, thickness: 18 })

    expect(target.x).toBe(400)
    expect(target.y).toBe(250)
    expect(target.z).toBe(-9)
  })

  it('positions camera at elevated angle', () => {
    const { position } = calculateCameraPosition({ width: 800, height: 500, thickness: 18 })

    // Camera should be above the workpiece (positive Z)
    expect(position.z).toBeGreaterThan(0)
    // Camera should be offset from center
    expect(position.x).toBeGreaterThan(400)
  })

  it('scales distance with workpiece size', () => {
    const small = calculateCameraPosition({ width: 100, height: 100, thickness: 18 })
    const large = calculateCameraPosition({ width: 2000, height: 1000, thickness: 18 })

    // Larger workpiece should position camera further away
    const smallDist = Math.sqrt(
      (small.position.x - small.target.x) ** 2 +
        (small.position.y - small.target.y) ** 2 +
        (small.position.z - small.target.z) ** 2,
    )
    const largeDist = Math.sqrt(
      (large.position.x - large.target.x) ** 2 +
        (large.position.y - large.target.y) ** 2 +
        (large.position.z - large.target.z) ** 2,
    )

    expect(largeDist).toBeGreaterThan(smallDist)
  })
})

describe('default camera constants', () => {
  it('has reasonable default position', () => {
    expect(DEFAULT_CAMERA_POSITION.z).toBeGreaterThan(0)
  })

  it('has reasonable default target', () => {
    expect(DEFAULT_CAMERA_TARGET.x).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_CAMERA_TARGET.y).toBeGreaterThanOrEqual(0)
  })
})

describe('VIEW_PRESETS', () => {
  it('has all 7 presets', () => {
    const presets: ViewPreset[] = ['perspective', 'top', 'bottom', 'front', 'back', 'right', 'left']
    for (const p of presets) {
      expect(VIEW_PRESETS[p]).toBeDefined()
      expect(VIEW_PRESETS[p].label).toBeTruthy()
      expect(VIEW_PRESETS[p].type).toMatch(/^(perspective|orthographic)$/)
    }
  })

  it('perspective is the only perspective type', () => {
    expect(VIEW_PRESETS.perspective.type).toBe('perspective')
    const orthos: ViewPreset[] = ['top', 'bottom', 'front', 'back', 'right', 'left']
    for (const p of orthos) {
      expect(VIEW_PRESETS[p].type).toBe('orthographic')
    }
  })
})

describe('calculatePresetCamera', () => {
  const dims = { width: 800, height: 500, thickness: 18 }

  it('perspective preset is not orthographic', () => {
    const result = calculatePresetCamera('perspective', dims)
    expect(result.isOrthographic).toBe(false)
  })

  it('top preset looks down Z axis', () => {
    const result = calculatePresetCamera('top', dims)
    expect(result.isOrthographic).toBe(true)
    // Camera above workpiece
    expect(result.position.z).toBeGreaterThan(result.target.z)
    // Camera directly above center (same X/Y as target)
    expect(result.position.x).toBeCloseTo(result.target.x, 0)
    expect(result.position.y).toBeCloseTo(result.target.y, 0)
  })

  it('front preset looks from negative Y', () => {
    const result = calculatePresetCamera('front', dims)
    expect(result.isOrthographic).toBe(true)
    expect(result.position.y).toBeLessThan(result.target.y)
  })

  it('right preset looks from positive X', () => {
    const result = calculatePresetCamera('right', dims)
    expect(result.isOrthographic).toBe(true)
    expect(result.position.x).toBeGreaterThan(result.target.x)
  })

  it('all presets center target on workpiece', () => {
    const presets: ViewPreset[] = ['perspective', 'top', 'bottom', 'front', 'back', 'right', 'left']
    for (const p of presets) {
      const result = calculatePresetCamera(p, dims)
      expect(result.target.x).toBeCloseTo(400, 0)
      expect(result.target.y).toBeCloseTo(250, 0)
      expect(result.target.z).toBeCloseTo(-9, 0)
    }
  })

  it('orthoSize scales with workpiece dimensions', () => {
    const small = calculatePresetCamera('top', { width: 100, height: 100, thickness: 18 })
    const large = calculatePresetCamera('top', { width: 2000, height: 1000, thickness: 18 })
    expect(large.orthoSize).toBeGreaterThan(small.orthoSize)
  })
})

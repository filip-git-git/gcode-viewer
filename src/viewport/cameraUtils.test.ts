import { describe, it, expect } from 'vitest'
import { calculateCameraPosition, DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from './cameraUtils'

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

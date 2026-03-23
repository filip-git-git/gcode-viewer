/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for ManifoldCsgEngine.
 *
 * Worker is mocked — these tests validate engine behavior on the main thread.
 * CSG correctness (geometry output) is validated via integration/visual tests
 * with the actual WASM worker in a browser environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ManifoldCsgEngine } from './manifoldEngine'
import type { CSGEngine } from './types'
import type { CsgOperationRequest } from '../simulation/types'

// ── Worker mock ──────────────────────────────────────────────────────────

vi.stubGlobal(
  'Worker',
  class {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: ErrorEvent) => void) | null = null
    onmessageerror: ((e: Event) => void) | null = null
    postMessage = vi.fn()
    terminate = vi.fn()
  },
)

// ── Helpers ──────────────────────────────────────────────────────────────

function makeDrillOp(overrides: Partial<CsgOperationRequest> = {}): CsgOperationRequest {
  return {
    type: 'drill',
    fromX: 50,
    fromY: 50,
    fromZ: 0,
    toX: 50,
    toY: 50,
    toZ: -10,
    toolNumber: 1,
    toolDiameter: 8,
    operationIndex: 0,
    sourceLineNumber: 1,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

let engine: ManifoldCsgEngine

beforeEach(() => {
  engine = new ManifoldCsgEngine()
})

describe('createWorkpiece', () => {
  it('creates box geometry with correct dimensions', () => {
    const geo = engine.createWorkpiece(800, 500, 18)
    geo.computeBoundingBox()
    const box = geo.boundingBox!

    expect(box.max.x - box.min.x).toBeCloseTo(800, 0)
    expect(box.max.y - box.min.y).toBeCloseTo(500, 0)
    expect(box.max.z - box.min.z).toBeCloseTo(18, 0)
  })

  it('positions workpiece with top face at z=0', () => {
    const geo = engine.createWorkpiece(200, 100, 18)
    geo.computeBoundingBox()
    const box = geo.boundingBox!

    expect(box.max.z).toBeCloseTo(0, 1)
    expect(box.min.z).toBeCloseTo(-18, 1)
  })

  it('positions workpiece starting at origin in XY', () => {
    const geo = engine.createWorkpiece(200, 100, 18)
    geo.computeBoundingBox()
    const box = geo.boundingBox!

    expect(box.min.x).toBeCloseTo(0, 1)
    expect(box.min.y).toBeCloseTo(0, 1)
    expect(box.max.x).toBeCloseTo(200, 1)
    expect(box.max.y).toBeCloseTo(100, 1)
  })
})

describe('synchronous methods throw (async-only engine)', () => {
  it('subtract() throws with async-only message', () => {
    const geo = engine.createWorkpiece(100, 100, 18)
    expect(() => engine.subtract(geo, makeDrillOp())).toThrow('async-only')
  })

  it('subtractBatch() throws with async-only message', () => {
    const geo = engine.createWorkpiece(100, 100, 18)
    expect(() => engine.subtractBatch(geo, [makeDrillOp()])).toThrow('async-only')
  })
})

describe('subtractBatchAsync', () => {
  it('returns workpiece unchanged when operations array is empty', async () => {
    const geo = engine.createWorkpiece(100, 100, 18)
    const result = await engine.subtractBatchAsync(geo, [])
    expect(result.geometry).toBe(geo)
    expect(result.elapsedMs).toBe(0)
  })

  it('throws if createWorkpiece was not called first', async () => {
    const freshEngine = new ManifoldCsgEngine()
    const geo = freshEngine.createWorkpiece(100, 100, 18)
    // Create a second fresh engine that never had createWorkpiece called
    const noWpEngine = new ManifoldCsgEngine()
    await expect(
      noWpEngine.subtractBatchAsync(geo, [makeDrillOp()]),
    ).rejects.toThrow('createWorkpiece')
  })
})

describe('dispose', () => {
  it('disposes geometry without error', () => {
    const geo = engine.createWorkpiece(100, 100, 18)
    expect(() => engine.dispose(geo)).not.toThrow()
  })
})

describe('terminate', () => {
  it('terminates the worker without error', () => {
    expect(() => engine.terminate()).not.toThrow()
  })
})

describe('CSGEngine interface compliance', () => {
  it('has subtractBatchAsync method', () => {
    expect(typeof engine.subtractBatchAsync).toBe('function')
  })

  it('satisfies CSGEngine interface', () => {
    const asEngine: CSGEngine = engine
    expect(typeof asEngine.createWorkpiece).toBe('function')
    expect(typeof asEngine.subtract).toBe('function')
    expect(typeof asEngine.subtractBatch).toBe('function')
    expect(typeof asEngine.dispose).toBe('function')
    expect(typeof asEngine.subtractBatchAsync).toBe('function')
  })
})

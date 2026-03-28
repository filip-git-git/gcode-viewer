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
    tipType: 'drill',
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

describe('worker message handling', () => {
  it('subtractBatchAsync sends correct message to worker', async () => {
    const eng = new ManifoldCsgEngine()
    const geo = eng.createWorkpiece(400, 300, 18)
    const ops = [makeDrillOp()]

    // Start the async call (will wait for worker response)
    const promise = eng.subtractBatchAsync(geo, ops)

    // Verify postMessage was called with correct data
    const worker = (eng as any).worker
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    const msg = worker.postMessage.mock.calls[0][0]
    expect(msg.type).toBe('subtractBatch')
    expect(msg.workpieceDims).toEqual({ width: 400, height: 300, thickness: 18 })
    expect(msg.operations).toEqual(ops)
    expect(typeof msg.id).toBe('number')

    // Simulate worker response to resolve the promise
    const responseGeo = {
      position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      index: new Uint32Array([0, 1, 2]),
      groups: [{ start: 0, count: 3, materialIndex: 0 }],
    }
    worker.onmessage({
      data: { id: msg.id, geometry: responseGeo, elapsedMs: 42 },
    })

    const result = await promise
    expect(result.elapsedMs).toBe(42)
    expect(result.geometry).toBeDefined()
    eng.terminate()
  })

  it('handles worker error response', async () => {
    const eng = new ManifoldCsgEngine()
    eng.createWorkpiece(100, 100, 18)
    const ops = [makeDrillOp()]

    const promise = eng.subtractBatchAsync(eng.createWorkpiece(100, 100, 18), ops)

    const worker = (eng as any).worker
    const msg = worker.postMessage.mock.calls[0][0]

    // Simulate worker error response
    worker.onmessage({
      data: { id: msg.id, error: 'WASM crash' },
    })

    await expect(promise).rejects.toThrow('WASM crash')
    eng.terminate()
  })

  it('handles worker onerror event', async () => {
    const eng = new ManifoldCsgEngine()
    eng.createWorkpiece(100, 100, 18)
    const ops = [makeDrillOp()]

    const promise = eng.subtractBatchAsync(eng.createWorkpiece(100, 100, 18), ops)

    const worker = (eng as any).worker

    // Simulate onerror
    worker.onerror({ message: 'Worker died' } as ErrorEvent)

    await expect(promise).rejects.toThrow('Manifold Worker error')
    eng.terminate()
  })

  it('assigns sequential message IDs', async () => {
    const eng = new ManifoldCsgEngine()
    eng.createWorkpiece(100, 100, 18)
    const ops = [makeDrillOp()]

    // Fire two requests
    eng.subtractBatchAsync(eng.createWorkpiece(100, 100, 18), ops).catch(() => {})
    eng.subtractBatchAsync(eng.createWorkpiece(100, 100, 18), ops).catch(() => {})

    const worker = (eng as any).worker
    const id0 = worker.postMessage.mock.calls[0][0].id
    const id1 = worker.postMessage.mock.calls[1][0].id
    expect(id1).toBe(id0 + 1)
    eng.terminate()
  })
})

describe('createWorkpiece geometry details', () => {
  it('creates geometry with material groups', () => {
    const geo = engine.createWorkpiece(200, 100, 18)
    // BoxGeometry has 6 groups by default (one per face)
    expect(geo.groups.length).toBe(6)
  })

  it('creates different workpiece sizes', () => {
    const small = engine.createWorkpiece(100, 50, 10)
    const large = engine.createWorkpiece(1000, 800, 36)

    small.computeBoundingBox()
    large.computeBoundingBox()

    expect(small.boundingBox!.max.x - small.boundingBox!.min.x).toBeCloseTo(100, 0)
    expect(large.boundingBox!.max.x - large.boundingBox!.min.x).toBeCloseTo(1000, 0)
    expect(large.boundingBox!.max.z - large.boundingBox!.min.z).toBeCloseTo(36, 0)
  })
})

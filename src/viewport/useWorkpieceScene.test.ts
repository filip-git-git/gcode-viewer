/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BufferGeometry } from 'three'
import type { CSGEngine, CsgResult } from '../csg/types'
import type { CsgOperationRequest } from '../simulation/types'

// Mock Vue lifecycle hooks since we're not in a component context
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

import { useWorkpieceScene } from './useWorkpieceScene'

// ── Mock CSG Engine ──────────────────────────────────────────────

function createSimpleMockEngine(): CSGEngine & { disposeCallCount: number; disposed: BufferGeometry[] } {
  const disposed: BufferGeometry[] = []
  return {
    disposeCallCount: 0,
    disposed,
    createWorkpiece(_w: number, _h: number, _t: number): BufferGeometry {
      return new BufferGeometry()
    },
    subtract(_workpiece: BufferGeometry, _operation: CsgOperationRequest): CsgResult {
      return {
        geometry: new BufferGeometry(),
        elapsedMs: 5,
      }
    },
    subtractBatch(_workpiece: BufferGeometry, operations: CsgOperationRequest[]): CsgResult {
      return {
        geometry: new BufferGeometry(),
        elapsedMs: 5 * operations.length,
      }
    },
    dispose(geometry: BufferGeometry): void {
      disposed.push(geometry)
      this.disposeCallCount++
      geometry.dispose()
    },
  }
}

function makeOp(index: number): CsgOperationRequest {
  return {
    type: 'mill',
    fromX: 10,
    fromY: 10,
    fromZ: 0,
    toX: 10,
    toY: 10,
    toZ: -5,
    toolNumber: 1,
    toolDiameter: 10,
    operationIndex: index,
    sourceLineNumber: index + 1,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('useWorkpieceScene', () => {
  let engine: ReturnType<typeof createSimpleMockEngine>

  beforeEach(() => {
    engine = createSimpleMockEngine()
  })

  it('starts with no workpiece', () => {
    const scene = useWorkpieceScene(engine)
    expect(scene.geometry.value).toBeNull()
    expect(scene.hasWorkpiece.value).toBe(false)
    expect(scene.operationsApplied.value).toBe(0)
  })

  it('creates workpiece from dimensions', () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 800, height: 500, thickness: 18 })

    expect(scene.geometry.value).toBeInstanceOf(BufferGeometry)
    expect(scene.hasWorkpiece.value).toBe(true)
  })

  it('disposes old workpiece before creating new one', () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 800, height: 500, thickness: 18 })
    const firstGeo = scene.geometry.value

    scene.createWorkpiece({ width: 600, height: 400, thickness: 19 })

    expect(engine.disposed).toContain(firstGeo)
  })

  it('disposes old geometry on each CSG operation (dispose before replace)', () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 200, height: 200, thickness: 18 })
    const initialGeo = scene.geometry.value

    scene.applyOperation(makeOp(0))

    // Initial geometry should have been disposed
    expect(engine.disposed).toContain(initialGeo)
    // New geometry should be different from initial
    expect(scene.geometry.value).not.toBe(initialGeo)
  })

  it('tracks operation count and CSG time', () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 200, height: 200, thickness: 18 })

    scene.applyOperation(makeOp(0))
    scene.applyOperation(makeOp(1))
    scene.applyOperation(makeOp(2))

    expect(scene.operationsApplied.value).toBe(3)
    expect(scene.totalCsgTimeMs.value).toBe(15) // 3 * 5ms mock
  })

  it('applyAllOperations applies in batches with disposal', async () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 200, height: 200, thickness: 18 })

    const ops = [makeOp(0), makeOp(1), makeOp(2)]
    await scene.applyAllOperations(ops)

    expect(scene.operationsApplied.value).toBe(3)
    // 1 batch = 1 disposal (old geometry replaced once)
    expect(engine.disposeCallCount).toBe(1)
  })

  it('reset disposes geometry and clears state', () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 200, height: 200, thickness: 18 })
    scene.applyOperation(makeOp(0))

    const currentGeo = scene.geometry.value
    scene.reset()

    expect(engine.disposed).toContain(currentGeo)
    expect(scene.geometry.value).toBeNull()
    expect(scene.hasWorkpiece.value).toBe(false)
    expect(scene.operationsApplied.value).toBe(0)
    expect(scene.totalCsgTimeMs.value).toBe(0)
  })

  it('does not crash when applying operation without workpiece', () => {
    const scene = useWorkpieceScene(engine)
    expect(() => scene.applyOperation(makeOp(0))).not.toThrow()
    expect(scene.operationsApplied.value).toBe(0)
  })

  it('does not crash on double reset', () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 200, height: 200, thickness: 18 })
    scene.reset()
    expect(() => scene.reset()).not.toThrow()
  })

  it('no monotonic heap growth pattern — disposes on every replace', () => {
    const scene = useWorkpieceScene(engine)
    scene.createWorkpiece({ width: 200, height: 200, thickness: 18 })

    // Apply 20 operations
    for (let i = 0; i < 20; i++) {
      scene.applyOperation(makeOp(i))
    }

    // Should have disposed 20 geometries (one per replace)
    expect(engine.disposeCallCount).toBe(20)
    expect(scene.operationsApplied.value).toBe(20)
  })
})

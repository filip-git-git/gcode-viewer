/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BufferGeometry } from 'three'
import type { CSGEngine, CsgResult } from '../csg/types'
import type { CsgOperationRequest } from './types'
import type { WorkpieceDimensions } from '../parser/types'

// Mock Vue lifecycle hooks
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

import { useWorkpieceScene } from '../viewport/useWorkpieceScene'
import { useSimulationPlayback } from './useSimulationPlayback'

// ── Mock CSG Engine ──────────────────────────────────────────────

function createMockEngine(): CSGEngine {
  return {
    createWorkpiece(): BufferGeometry {
      return new BufferGeometry()
    },
    subtract(_wp: BufferGeometry, _op: CsgOperationRequest): CsgResult {
      return { geometry: new BufferGeometry(), elapsedMs: 1 }
    },
    subtractBatch(_wp: BufferGeometry, ops: CsgOperationRequest[]): CsgResult {
      return { geometry: new BufferGeometry(), elapsedMs: ops.length }
    },
    dispose(geo: BufferGeometry): void {
      geo.dispose()
    },
  }
}

function makeOps(count: number): CsgOperationRequest[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'mill' as const,
    tipType: 'flat-end-mill' as const,
    fromX: i * 10,
    fromY: 0,
    fromZ: 0,
    toX: (i + 1) * 10,
    toY: 0,
    toZ: -5,
    toolNumber: 1,
    toolDiameter: 10,
    operationIndex: i,
    sourceLineNumber: i + 5,
  }))
}

const DIMS: WorkpieceDimensions = { width: 200, height: 100, thickness: 18 }

// ── Tests ────────────────────────────────────────────────────────

describe('useSimulationPlayback', () => {
  let engine: CSGEngine
  let scene: ReturnType<typeof useWorkpieceScene>
  let playback: ReturnType<typeof useSimulationPlayback>

  beforeEach(() => {
    engine = createMockEngine()
    scene = useWorkpieceScene(engine)
    playback = useSimulationPlayback(scene)
  })

  it('starts with zero state', () => {
    expect(playback.currentStep.value).toBe(0)
    expect(playback.totalSteps.value).toBe(0)
    expect(playback.isPlaying.value).toBe(false)
    expect(playback.isStepMode.value).toBe(false)
    expect(playback.currentLineNumber.value).toBeNull()
  })

  it('load sets totalSteps', () => {
    playback.load(makeOps(5), DIMS)
    expect(playback.totalSteps.value).toBe(5)
    expect(playback.currentStep.value).toBe(0)
    expect(playback.isStepMode.value).toBe(false)
  })

  it('enterStepMode sets isStepMode and resets step to 0', () => {
    playback.load(makeOps(5), DIMS)
    playback.enterStepMode()
    expect(playback.isStepMode.value).toBe(true)
    expect(playback.currentStep.value).toBe(0)
  })

  it('enterStepMode is no-op with no operations', () => {
    playback.load([], DIMS)
    playback.enterStepMode()
    expect(playback.isStepMode.value).toBe(false)
  })

  it('exitStepMode clears step mode and recomputes final workpiece', async () => {
    const ops = makeOps(5)
    playback.load(ops, DIMS)
    playback.enterStepMode()
    await playback.stepForward()
    await playback.stepForward()
    expect(playback.currentStep.value).toBe(2)
    const recomputeSpy = vi.spyOn(scene, 'recomputeWorkpiece')
    playback.exitStepMode()
    expect(playback.isStepMode.value).toBe(false)
    expect(recomputeSpy).toHaveBeenCalledOnce()
    expect(recomputeSpy).toHaveBeenCalledWith(DIMS, ops)
  })

  it('stepForward increments currentStep', async () => {
    playback.load(makeOps(5), DIMS)
    playback.enterStepMode()

    await playback.stepForward()
    expect(playback.currentStep.value).toBe(1)

    await playback.stepForward()
    expect(playback.currentStep.value).toBe(2)
  })

  it('stepForward does not exceed totalSteps', async () => {
    playback.load(makeOps(2), DIMS)
    playback.enterStepMode()

    await playback.stepForward()
    await playback.stepForward()
    await playback.stepForward() // should be no-op
    expect(playback.currentStep.value).toBe(2)
  })

  it('stepBack decrements currentStep', async () => {
    playback.load(makeOps(5), DIMS)
    playback.enterStepMode()

    await playback.stepForward()
    await playback.stepForward()
    await playback.stepBack()
    expect(playback.currentStep.value).toBe(1)
  })

  it('stepBack does not go below 0', async () => {
    playback.load(makeOps(5), DIMS)
    playback.enterStepMode()

    await playback.stepBack() // should be no-op
    expect(playback.currentStep.value).toBe(0)
  })

  it('goToStep jumps to arbitrary step', async () => {
    playback.load(makeOps(10), DIMS)
    playback.enterStepMode()

    await playback.goToStep(7)
    expect(playback.currentStep.value).toBe(7)
  })

  it('goToStep clamps to valid range', async () => {
    playback.load(makeOps(5), DIMS)
    playback.enterStepMode()

    await playback.goToStep(100)
    expect(playback.currentStep.value).toBe(5)

    await playback.goToStep(-5)
    expect(playback.currentStep.value).toBe(0)
  })

  it('reset sets step back to 0', async () => {
    playback.load(makeOps(5), DIMS)
    playback.enterStepMode()

    await playback.stepForward()
    await playback.stepForward()
    playback.reset()
    expect(playback.currentStep.value).toBe(0)
    expect(playback.isPlaying.value).toBe(false)
  })

  it('currentLineNumber returns source line of current operation', async () => {
    playback.load(makeOps(5), DIMS)
    playback.enterStepMode()

    expect(playback.currentLineNumber.value).toBeNull() // step 0 = no op

    await playback.stepForward() // step 1 → op[0].sourceLineNumber = 5
    expect(playback.currentLineNumber.value).toBe(5)

    await playback.stepForward() // step 2 → op[1].sourceLineNumber = 6
    expect(playback.currentLineNumber.value).toBe(6)
  })

  it('currentLineNumber is null when not in step mode', async () => {
    playback.load(makeOps(5), DIMS)
    expect(playback.currentLineNumber.value).toBeNull()
  })

  it('play starts auto-advance', async () => {
    vi.useFakeTimers()
    playback.load(makeOps(3), DIMS)
    playback.enterStepMode()

    playback.play()
    expect(playback.isPlaying.value).toBe(true)

    // Advance timers by one interval
    await vi.advanceTimersByTimeAsync(200)
    expect(playback.currentStep.value).toBe(1)

    playback.pause()
    expect(playback.isPlaying.value).toBe(false)

    vi.useRealTimers()
  })

  it('pause stops auto-advance', async () => {
    vi.useFakeTimers()
    playback.load(makeOps(10), DIMS)
    playback.enterStepMode()

    playback.play()
    await vi.advanceTimersByTimeAsync(200)
    playback.pause()

    const stepAfterPause = playback.currentStep.value
    await vi.advanceTimersByTimeAsync(1000)
    expect(playback.currentStep.value).toBe(stepAfterPause)

    vi.useRealTimers()
  })
})

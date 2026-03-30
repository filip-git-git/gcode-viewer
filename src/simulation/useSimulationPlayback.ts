/**
 * Composable for step-by-step simulation playback.
 *
 * Manages a playback cursor over CsgOperationRequest[] and re-computes
 * the workpiece geometry at each step by sending operations[0..currentStep]
 * to the CSG engine's async worker.
 *
 * With Manifold WASM performance (~1ms/op), recomputing 50 ops from scratch
 * takes ~50ms — fast enough for interactive stepping without snapshots.
 */

import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import type { CsgOperationRequest } from './types'
import type { WorkpieceDimensions } from '../parser/types'
import type { WorkpieceSceneState } from '../viewport/useWorkpieceScene'

const DEFAULT_PLAY_INTERVAL_MS = 200

export interface SimulationPlaybackState {
  /** Current step index (0 = no operations applied, totalSteps = all applied) */
  currentStep: Ref<number>
  /** Total number of steps available */
  totalSteps: ComputedRef<number>
  /** Whether auto-play is active */
  isPlaying: Ref<boolean>
  /** Whether the simulation is in step-by-step mode (vs final result) */
  isStepMode: Ref<boolean>
  /** Source line number of the current operation (for editor sync) */
  currentLineNumber: ComputedRef<number | null>
  /** Whether we're computing a step */
  isComputing: Ref<boolean>

  /** Load operations for playback */
  load(ops: CsgOperationRequest[], dims: WorkpieceDimensions): void
  /** Enter step-by-step mode at step 0 */
  enterStepMode(): void
  /** Exit step-by-step mode and show final result */
  exitStepMode(): void
  /** Step forward one operation */
  stepForward(): Promise<void>
  /** Step backward one operation */
  stepBack(): Promise<void>
  /** Jump to a specific step */
  goToStep(step: number): Promise<void>
  /** Start auto-play */
  play(): void
  /** Pause auto-play */
  pause(): void
  /** Reset to step 0 */
  reset(): void
}

export function useSimulationPlayback(scene: WorkpieceSceneState): SimulationPlaybackState {
  const currentStep = ref(0)
  const isPlaying = ref(false)
  const isStepMode = ref(false)
  const isComputing = ref(false)

  const operations = shallowRef<CsgOperationRequest[]>([])
  let dimensions: WorkpieceDimensions | null = null
  let playTimer: ReturnType<typeof setInterval> | null = null

  const totalSteps = computed(() => operations.value.length)

  const currentLineNumber = computed(() => {
    if (!isStepMode.value || currentStep.value === 0 || operations.value.length === 0) {
      return null
    }
    const op = operations.value[currentStep.value - 1]
    return op ? op.sourceLineNumber : null
  })

  function load(ops: CsgOperationRequest[], dims: WorkpieceDimensions): void {
    pause()
    operations.value = ops
    dimensions = dims
    currentStep.value = 0
    isStepMode.value = false
  }

  function enterStepMode(): void {
    if (operations.value.length === 0 || !dimensions) return
    pause()
    isStepMode.value = true
    currentStep.value = 0
    // Show bare workpiece at step 0 (no flicker — single call)
    scene.recomputeWorkpiece(dimensions, [])
  }

  function exitStepMode(): void {
    pause()
    isStepMode.value = false
    currentStep.value = 0
    if (dimensions && operations.value.length > 0) {
      scene.recomputeWorkpiece(dimensions, operations.value)
    }
  }

  async function applyStepGeometry(step: number): Promise<void> {
    if (!dimensions) return
    isComputing.value = true
    try {
      const opsSlice = operations.value.slice(0, step)
      await scene.recomputeWorkpiece(dimensions, opsSlice)
    } finally {
      isComputing.value = false
    }
  }

  async function goToStep(step: number): Promise<void> {
    const clamped = Math.max(0, Math.min(step, operations.value.length))
    if (clamped === currentStep.value) return
    currentStep.value = clamped
    await applyStepGeometry(clamped)
  }

  async function stepForward(): Promise<void> {
    if (currentStep.value >= operations.value.length) return
    await goToStep(currentStep.value + 1)
  }

  async function stepBack(): Promise<void> {
    if (currentStep.value <= 0) return
    await goToStep(currentStep.value - 1)
  }

  function play(): void {
    if (isPlaying.value) return
    if (!isStepMode.value) enterStepMode()
    isPlaying.value = true
    playTimer = setInterval(async () => {
      if (currentStep.value >= operations.value.length) {
        pause()
        return
      }
      await stepForward()
    }, DEFAULT_PLAY_INTERVAL_MS)
  }

  function pause(): void {
    isPlaying.value = false
    if (playTimer) {
      clearInterval(playTimer)
      playTimer = null
    }
  }

  function reset(): void {
    pause()
    currentStep.value = 0
    if (isStepMode.value && dimensions) {
      scene.recomputeWorkpiece(dimensions, [])
    }
  }

  return {
    currentStep,
    totalSteps,
    isPlaying,
    isStepMode,
    currentLineNumber,
    isComputing,
    load,
    enterStepMode,
    exitStepMode,
    stepForward,
    stepBack,
    goToStep,
    play,
    pause,
    reset,
  }
}

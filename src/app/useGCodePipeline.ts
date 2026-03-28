/**
 * GCode pipeline composable — wires editor → parser → simulation → CSG → viewport.
 *
 * Reactive: when gcodeText changes, the full pipeline re-executes (debounced 300ms).
 * Exposes all intermediate state for UI consumption (warnings, dimensions, etc.).
 */

import { ref, shallowRef, watch, onUnmounted, type Ref, type ShallowRef } from 'vue'
import { parseGCode } from '../parser/parser'
import { simulate } from '../simulation/simulationEngine'
import { ManifoldCsgEngine } from '../csg/manifoldEngine'
import { useWorkpieceScene, type WorkpieceSceneState } from '../viewport/useWorkpieceScene'
import { useToolStore } from '../tools/useToolStore'
import { useSimulationPlayback, type SimulationPlaybackState } from '../simulation/useSimulationPlayback'
import type { ParseResult, ParseWarning, WorkpieceDimensions } from '../parser/types'
import type { CsgOperationRequest, SimulationWarning } from '../simulation/types'

const DEBOUNCE_MS = 300

export interface PipelineState {
  gcodeText: Ref<string>
  isProcessing: Ref<boolean>
  parseWarnings: Ref<ParseWarning[]>
  simWarnings: Ref<SimulationWarning[]>
  dimensions: ShallowRef<WorkpieceDimensions | null>
  manualDimensions: Ref<WorkpieceDimensions | null>
  lineCount: Ref<number>
  operationCount: Ref<number>
  toolsUsed: Ref<number[]>
  scene: WorkpieceSceneState
  playback: SimulationPlaybackState
  fileName: Ref<string>
  setManualDimensions(dims: WorkpieceDimensions): void
  loadFile(name: string, content: string): void
  reprocess(): void
}

export function useGCodePipeline(): PipelineState {
  const engine = new ManifoldCsgEngine()
  const scene = useWorkpieceScene(engine)
  const playback = useSimulationPlayback(scene)
  const toolStore = useToolStore()

  const gcodeText = ref('')
  const isProcessing = ref(false)
  const parseWarnings = ref<ParseWarning[]>([])
  const simWarnings = ref<SimulationWarning[]>([])
  const dimensions = shallowRef<WorkpieceDimensions | null>(null)
  const manualDimensions = ref<WorkpieceDimensions | null>(null)
  const lineCount = ref(0)
  const operationCount = ref(0)
  const toolsUsed = ref<number[]>([])
  const fileName = ref('')

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null

  async function process(): Promise<void> {
    // Abort any in-flight CSG work
    if (abortController) {
      abortController.abort()
      abortController = null
    }

    const text = gcodeText.value.trim()

    if (!text) {
      scene.reset()
      parseWarnings.value = []
      simWarnings.value = []
      dimensions.value = null
      lineCount.value = 0
      operationCount.value = 0
      toolsUsed.value = []
      isProcessing.value = false
      return
    }

    isProcessing.value = true

    try {
      // Step 1: Parse
      const parseResult: ParseResult = parseGCode(text)
      parseWarnings.value = parseResult.warnings
      lineCount.value = text.split('\n').length

      // Step 2: Simulate
      const simInput: Parameters<typeof simulate>[0] = manualDimensions.value
        ? { parseResult, tools: toolStore.tools, defaultWorkpiece: manualDimensions.value }
        : { parseResult, tools: toolStore.tools }
      const simResult = simulate(simInput)
      simWarnings.value = simResult.warnings
      dimensions.value = simResult.dimensions
      operationCount.value = simResult.csgRequests.length
      toolsUsed.value = simResult.toolsUsed

      // Step 3: Load playback state and compute CSG
      if (simResult.dimensions && simResult.csgRequests.length > 0) {
        playback.load(simResult.csgRequests, simResult.dimensions)

        if (playback.isStepMode.value) {
          // In step mode: re-enter at current step
          playback.enterStepMode()
        } else {
          // Normal mode: show final result
          scene.createWorkpiece(simResult.dimensions)
          abortController = new AbortController()
          await scene.applyAllOperations(simResult.csgRequests, abortController.signal)
        }
      } else if (simResult.dimensions) {
        playback.load([], simResult.dimensions)
        scene.createWorkpiece(simResult.dimensions)
      } else {
        playback.load([], { width: 0, height: 0, thickness: 0 })
        scene.reset()
      }
    } catch (e) {
      console.error('[pipeline] Processing error:', e)
      scene.reset()
    } finally {
      isProcessing.value = false
    }
  }

  function debouncedProcess(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(process, DEBOUNCE_MS)
  }

  watch(gcodeText, debouncedProcess)
  watch(() => toolStore.tools, debouncedProcess, { deep: true })
  watch(manualDimensions, debouncedProcess, { deep: true })

  function setManualDimensions(dims: WorkpieceDimensions): void {
    manualDimensions.value = dims
  }

  function loadFile(name: string, content: string): void {
    fileName.value = name
    gcodeText.value = content
  }

  function reprocess(): void {
    process()
  }

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
    engine.terminate()
  })

  return {
    gcodeText,
    isProcessing,
    parseWarnings,
    simWarnings,
    dimensions,
    manualDimensions,
    lineCount,
    operationCount,
    toolsUsed,
    scene,
    playback,
    fileName,
    setManualDimensions,
    loadFile,
    reprocess,
  }
}

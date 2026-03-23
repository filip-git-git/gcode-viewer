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
import type { ParseResult, ParseWarning, WorkpieceDimensions } from '../parser/types'
import type { SimulationWarning } from '../simulation/types'

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
  scene: WorkpieceSceneState
  fileName: Ref<string>
  setManualDimensions(dims: WorkpieceDimensions): void
  loadFile(name: string, content: string): void
  reprocess(): void
}

export function useGCodePipeline(): PipelineState {
  const engine = new ManifoldCsgEngine()
  const scene = useWorkpieceScene(engine)
  const toolStore = useToolStore()

  const gcodeText = ref('')
  const isProcessing = ref(false)
  const parseWarnings = ref<ParseWarning[]>([])
  const simWarnings = ref<SimulationWarning[]>([])
  const dimensions = shallowRef<WorkpieceDimensions | null>(null)
  const manualDimensions = ref<WorkpieceDimensions | null>(null)
  const lineCount = ref(0)
  const operationCount = ref(0)
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
      const simInput = {
        parseResult,
        tools: toolStore.tools,
        defaultWorkpiece: manualDimensions.value ?? undefined,
      }
      const simResult = simulate(simInput as Parameters<typeof simulate>[0])
      simWarnings.value = simResult.warnings
      dimensions.value = simResult.dimensions
      operationCount.value = simResult.csgRequests.length

      // Step 3: CSG — async with abort support
      if (simResult.dimensions && simResult.csgRequests.length > 0) {
        scene.createWorkpiece(simResult.dimensions)
        abortController = new AbortController()
        await scene.applyAllOperations(simResult.csgRequests, abortController.signal)
      } else if (simResult.dimensions) {
        scene.createWorkpiece(simResult.dimensions)
      } else {
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
    scene,
    fileName,
    setManualDimensions,
    loadFile,
    reprocess,
  }
}

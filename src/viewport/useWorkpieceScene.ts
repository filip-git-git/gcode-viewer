/**
 * Composable for managing workpiece 3D scene state.
 *
 * Bridges the simulation/CSG pipeline with the TresJS viewport.
 * Handles geometry lifecycle: applies CSG operations via async worker,
 * disposes old geometry before replacing, and exposes reactive mesh state.
 *
 * Uses two materials: surface laminate (outer faces) and exposed core
 * (machined faces). Manifold's face provenance data drives the assignment.
 */

import { ref, shallowRef, onUnmounted, type Ref, type ShallowRef } from 'vue'
import { MeshStandardMaterial, BufferGeometry, DoubleSide } from 'three'
import type { WorkpieceDimensions } from '../parser/types'
import type { CsgOperationRequest } from '../simulation/types'
import type { CSGEngine } from '../csg/types'

export interface WorkpieceSceneState {
  /** Current workpiece geometry (reactive, shallow) */
  geometry: ShallowRef<BufferGeometry | null>
  /** Materials for the workpiece mesh [surface, core] */
  materials: MeshStandardMaterial[]
  /** Whether a workpiece is currently loaded */
  hasWorkpiece: Ref<boolean>
  /** Number of CSG operations applied */
  operationsApplied: Ref<number>
  /** Total elapsed CSG time in ms */
  totalCsgTimeMs: Ref<number>

  /** Create a fresh workpiece from dimensions */
  createWorkpiece(dimensions: WorkpieceDimensions): void
  /** Apply a single CSG operation to the current workpiece */
  applyOperation(operation: CsgOperationRequest): void
  /** Apply all CSG operations — uses async worker if available */
  applyAllOperations(operations: CsgOperationRequest[], signal?: AbortSignal): Promise<void>
  /** Reset — dispose current workpiece */
  reset(): void
}

const SURFACE_COLOR = 0xb8884c // Laminate / veneer (darker warm brown)
const CORE_COLOR = 0xf0e6c8 // Exposed chipboard core (pale cream)

export function useWorkpieceScene(engine: CSGEngine): WorkpieceSceneState {
  const geometry = shallowRef<BufferGeometry | null>(null)
  const hasWorkpiece = ref(false)
  const operationsApplied = ref(0)
  const totalCsgTimeMs = ref(0)

  const surfaceMaterial = new MeshStandardMaterial({
    color: SURFACE_COLOR,
    roughness: 0.7,
    side: DoubleSide,
  })

  const coreMaterial = new MeshStandardMaterial({
    color: CORE_COLOR,
    roughness: 0.9,
    side: DoubleSide,
  })

  const materials = [surfaceMaterial, coreMaterial]

  function createWorkpiece(dimensions: WorkpieceDimensions): void {
    reset()
    geometry.value = engine.createWorkpiece(
      dimensions.width,
      dimensions.height,
      dimensions.thickness,
    )
    hasWorkpiece.value = true
  }

  function applyOperation(operation: CsgOperationRequest): void {
    if (!geometry.value) return

    const result = engine.subtract(geometry.value, operation)
    engine.dispose(geometry.value)
    geometry.value = result.geometry
    operationsApplied.value++
    totalCsgTimeMs.value += result.elapsedMs
  }

  async function applyAllOperations(operations: CsgOperationRequest[], signal?: AbortSignal): Promise<void> {
    if (!geometry.value || operations.length === 0) return
    if (signal?.aborted) return

    // Use async worker path if available
    if (engine.subtractBatchAsync) {
      const result = await engine.subtractBatchAsync(geometry.value, operations)
      if (signal?.aborted) return
      engine.dispose(geometry.value)
      geometry.value = result.geometry
      operationsApplied.value += operations.length
      totalCsgTimeMs.value += result.elapsedMs
    } else {
      // Fallback: synchronous batch
      const result = engine.subtractBatch(geometry.value, operations)
      engine.dispose(geometry.value)
      geometry.value = result.geometry
      operationsApplied.value += operations.length
      totalCsgTimeMs.value += result.elapsedMs
    }
  }

  function reset(): void {
    if (geometry.value) {
      engine.dispose(geometry.value)
      geometry.value = null
    }
    hasWorkpiece.value = false
    operationsApplied.value = 0
    totalCsgTimeMs.value = 0
  }

  onUnmounted(() => {
    reset()
    surfaceMaterial.dispose()
    coreMaterial.dispose()
  })

  return {
    geometry,
    materials,
    hasWorkpiece,
    operationsApplied,
    totalCsgTimeMs,
    createWorkpiece,
    applyOperation,
    applyAllOperations,
    reset,
  }
}

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
  /** Apply all CSG operations — uses async worker if available */
  applyAllOperations(operations: CsgOperationRequest[], signal?: AbortSignal): Promise<void>
  /**
   * Compute workpiece from scratch (create + subtract) with a single atomic geometry swap.
   * No intermediate bare-box flash — geometry only updates once, when the result is ready.
   */
  recomputeWorkpiece(dimensions: WorkpieceDimensions, operations: CsgOperationRequest[], signal?: AbortSignal): Promise<void>
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

  async function recomputeWorkpiece(
    dimensions: WorkpieceDimensions,
    operations: CsgOperationRequest[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) return

    // createWorkpiece sets lastWorkpieceDims in the engine (needed by the worker)
    // but we do NOT assign it to geometry.value yet — no re-render until result is ready
    const freshGeo = engine.createWorkpiece(dimensions.width, dimensions.height, dimensions.thickness)

    if (operations.length === 0) {
      // BoxGeometry has 6 groups (one per face, materialIndex 0-5).
      // With a 2-material array only indices 0-1 exist — faces 2-5 are invisible.
      // clearGroups() makes it worse: empty groups array = zero draw calls = nothing renders.
      // Fix: remap all groups to materialIndex 0 (surface laminate) so all faces render.
      for (const group of freshGeo.groups) {
        group.materialIndex = 0
      }
      if (geometry.value) engine.dispose(geometry.value)
      geometry.value = freshGeo
      hasWorkpiece.value = true
      operationsApplied.value = 0
      totalCsgTimeMs.value = 0
      return
    }

    // Compute CSG off-thread, then do a single swap
    let result: { geometry: BufferGeometry; elapsedMs: number }
    if (engine.subtractBatchAsync) {
      result = await engine.subtractBatchAsync(freshGeo, operations)
    } else {
      result = engine.subtractBatch(freshGeo, operations)
    }

    if (signal?.aborted) {
      engine.dispose(freshGeo)
      engine.dispose(result.geometry)
      return
    }

    // freshGeo was only used to set lastWorkpieceDims — dispose it now
    engine.dispose(freshGeo)

    // Single atomic swap — geometry.value changes exactly once
    if (geometry.value) engine.dispose(geometry.value)
    geometry.value = result.geometry
    hasWorkpiece.value = true
    operationsApplied.value = operations.length
    totalCsgTimeMs.value = result.elapsedMs
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
    applyAllOperations,
    recomputeWorkpiece,
    reset,
  }
}

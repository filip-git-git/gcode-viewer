/**
 * CSG module types — CSGEngine interface for library-swappable boolean operations.
 */

import type { BufferGeometry } from 'three'
import type { CsgOperationRequest } from '../simulation/types'

/** Result of a CSG operation */
export interface CsgResult {
  geometry: BufferGeometry
  elapsedMs: number
}

/** CSG engine interface — allows library swap without modifying consumers (ADR-006) */
export interface CSGEngine {
  /** Create initial workpiece geometry from dimensions */
  createWorkpiece(width: number, height: number, thickness: number): BufferGeometry

  /** Subtract tool volume from workpiece. Returns new geometry; caller disposes the old one. */
  subtract(workpiece: BufferGeometry, operation: CsgOperationRequest): CsgResult

  /** Subtract multiple tool volumes in a single CSG pass (merge tool geos, one boolean op). */
  subtractBatch(workpiece: BufferGeometry, operations: CsgOperationRequest[]): CsgResult

  /** Async batch subtraction — offloads to Web Worker */
  subtractBatchAsync?(workpiece: BufferGeometry, operations: CsgOperationRequest[]): Promise<CsgResult>

  /** Dispose geometry and free GPU-side buffers */
  dispose(geometry: BufferGeometry): void
}

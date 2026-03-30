/**
 * ManifoldCsgEngine — CSGEngine implementation using manifold-3d WASM in a Web Worker.
 *
 * Replaces BvhCsgEngine and WorkerCsgEngine (see ADR-006).
 * The main thread never blocks on boolean operations.
 *
 * All heavy work runs in manifoldWorker.ts off the main thread.
 * createWorkpiece() is synchronous (just Three.js BoxGeometry, no WASM needed).
 * subtract() and subtractBatch() throw — this engine is async-only.
 * Use subtractBatchAsync() for all CSG operations.
 */

import { BoxGeometry, BufferAttribute, BufferGeometry } from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CsgOperationRequest } from '../simulation/types'
import type { CSGEngine, CsgResult } from './types'
import type {
  ManifoldWorkerRequest,
  ManifoldWorkerResponse,
  SerializedGeometry,
  WorkpieceDims,
} from './manifoldWorker'

export class ManifoldCsgEngine implements CSGEngine {
  private worker: Worker
  private nextId = 0
  private pending = new Map<
    number,
    {
      resolve: (r: ManifoldWorkerResponse) => void
      reject: (e: Error) => void
    }
  >()
  private lastWorkpieceDims: WorkpieceDims | null = null

  constructor() {
    this.worker = new Worker(new URL('./manifoldWorker.ts', import.meta.url), { type: 'module' })

    this.worker.onmessage = (e: MessageEvent<ManifoldWorkerResponse & { error?: string }>) => {
      const { id, error } = e.data
      const entry = this.pending.get(id)
      if (entry) {
        this.pending.delete(id)
        if (error) {
          entry.reject(new Error(error))
        } else {
          entry.resolve(e.data)
        }
      }
    }

    this.worker.onerror = (e: ErrorEvent) => {
      console.error('[Manifold Worker] Error:', e.message)
      for (const [id, entry] of this.pending) {
        entry.reject(new Error(`Manifold Worker error: ${e.message}`))
        this.pending.delete(id)
      }
    }

    this.worker.onmessageerror = (e) => {
      console.error('[Manifold Worker] Message error:', e)
    }
  }

  private send(req: Omit<ManifoldWorkerRequest, 'id'>): Promise<ManifoldWorkerResponse> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const msg = { ...req, id } as ManifoldWorkerRequest
      this.worker.postMessage(msg)
    })
  }

  private deserializeGeo(data: SerializedGeometry): BufferGeometry {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(data.position, 3))
    if (data.index) geo.setIndex(new BufferAttribute(data.index, 1))
    // Manifold outputs shared vertices at hard edges (e.g. 8 verts for a cube).
    // Plain computeVertexNormals() would average normals across 90° edges, producing
    // visible diagonal shading artifacts. toCreasedNormals splits vertices at edges
    // exceeding the crease angle, giving sharp edges on flat-to-wall transitions
    // while keeping smooth shading on curved surfaces (cylinder walls).
    const creased = toCreasedNormals(geo, Math.PI / 6) // 30° crease angle
    geo.dispose()

    // Apply material groups from Manifold's face provenance.
    // Group materialIndex 0 = original workpiece surface (laminate).
    // Group materialIndex 1 = machined faces (exposed core).
    // toCreasedNormals preserves triangle order, so groups remain valid.
    if (data.groups.length > 0) {
      for (const g of data.groups) {
        creased.addGroup(g.start, g.count, g.materialIndex)
      }
    }

    creased.computeBoundingSphere()
    return creased
  }

  createWorkpiece(width: number, height: number, thickness: number): BufferGeometry {
    // Store dimensions for the worker (it uses native Manifold.cube())
    this.lastWorkpieceDims = { width, height, thickness }
    // Return Three.js geometry for the viewport display
    const geo = new BoxGeometry(width, height, thickness)
    geo.translate(width / 2, height / 2, -thickness / 2)
    // BoxGeometry creates 6 groups (materialIndex 0-5), but we only have 2 materials.
    // Remap all groups to materialIndex 0 so all faces render correctly.
    for (const group of geo.groups) {
      group.materialIndex = 0
    }
    return geo
  }

  subtract(_workpiece: BufferGeometry, _operation: CsgOperationRequest): CsgResult {
    throw new Error('ManifoldCsgEngine.subtract() is async-only. Use subtractBatchAsync().')
  }

  subtractBatch(_workpiece: BufferGeometry, _operations: CsgOperationRequest[]): CsgResult {
    throw new Error('ManifoldCsgEngine.subtractBatch() is async-only. Use subtractBatchAsync().')
  }

  async subtractBatchAsync(
    workpiece: BufferGeometry,
    operations: CsgOperationRequest[],
  ): Promise<CsgResult> {
    if (operations.length === 0) {
      return { geometry: workpiece, elapsedMs: 0 }
    }

    if (!this.lastWorkpieceDims) {
      throw new Error('createWorkpiece() must be called before subtractBatchAsync()')
    }

    // Send dimensions — the worker creates the workpiece natively via Manifold.cube()
    const response = await this.send({
      type: 'subtractBatch',
      workpieceDims: this.lastWorkpieceDims,
      operations,
    })

    return {
      geometry: this.deserializeGeo(response.geometry),
      elapsedMs: response.elapsedMs,
    }
  }

  dispose(geometry: BufferGeometry): void {
    geometry.dispose()
  }

  terminate(): void {
    this.worker.terminate()
  }
}

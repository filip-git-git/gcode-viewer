/**
 * Web Worker for CSG operations using manifold-3d WASM.
 * Runs off the main thread — UI never blocks on CSG computation.
 *
 * Protocol: receive ManifoldWorkerRequest, post ManifoldWorkerResponse.
 * Geometry serialized as transferable Float32Array/Uint32Array (zero-copy).
 *
 * Uses Manifold native primitives (cube, cylinder, hull) — no Three.js in
 * the worker. This guarantees manifold (watertight) input geometry and avoids
 * the "Not manifold" errors that Three.js indexed geometries would cause.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — manifold-3d ships its own declaration files
import Module from 'manifold-3d'
import type { CsgOperationRequest } from '../simulation/types'

const TOOL_CLEARANCE = 50
// 0 = use Manifold's global quality settings (setMinCircularAngle/setMinCircularEdgeLength)
// which produce smoother cylinders than a hardcoded low segment count
const RADIAL_SEGMENTS = 0

// ── Types ──────────────────────────────────────────────────────────────────

export interface MaterialGroup {
  start: number
  count: number
  materialIndex: number
}

export interface SerializedGeometry {
  position: Float32Array
  index: Uint32Array | null
  groups: MaterialGroup[]
}

export interface WorkpieceDims {
  width: number
  height: number
  thickness: number
}

export interface ManifoldWorkerRequest {
  id: number
  type: 'subtractBatch'
  workpieceDims: WorkpieceDims
  operations: CsgOperationRequest[]
}

export interface ManifoldWorkerResponse {
  id: number
  geometry: SerializedGeometry
  elapsedMs: number
}

// ── WASM module (lazy init on first use) ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWasm(): Promise<any> {
  if (!wasmModule) {
    wasmModule = await Module()
    wasmModule.setup()
    wasmModule.setMinCircularAngle(3)
    wasmModule.setMinCircularEdgeLength(0.5)
  }
  return wasmModule
}

// ── Native Manifold tool sweep creation ───────────────────────────────────

/**
 * Create a tool sweep volume using native Manifold primitives.
 * Vertical plunge → cylinder. Lateral move → convex hull of two cylinders.
 * Caller must call .delete() on the returned Manifold when done.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createToolManifold(wasm: any, op: CsgOperationRequest): any {
  const { Manifold } = wasm
  const radius = op.toolDiameter / 2

  const dx = op.toX - op.fromX
  const dy = op.toY - op.fromY
  const lateralDist = Math.sqrt(dx * dx + dy * dy)

  if (lateralDist < 0.001) {
    // Vertical plunge — single cylinder along Z
    const zBottom = Math.min(op.fromZ, op.toZ)
    const zTop = Math.max(op.fromZ, op.toZ) + TOOL_CLEARANCE
    const height = zTop - zBottom
    return Manifold.cylinder(height, radius, radius, RADIAL_SEGMENTS)
      .translate([op.fromX, op.fromY, zBottom])
  }

  // Lateral move — hull of two cylinders, each at its own Z position.
  // Each cylinder extends from its tip (fromZ or toZ) up to TOOL_CLEARANCE
  // above the surface (Z=0). For ramp milling (fromZ ≠ toZ), the hull
  // produces a correctly sloped cut — shallow at one end, deep at the other.
  const topZ = TOOL_CLEARANCE
  const h1 = topZ - op.fromZ
  const h2 = topZ - op.toZ

  const cyl1 = Manifold.cylinder(h1, radius, radius, RADIAL_SEGMENTS)
    .translate([op.fromX, op.fromY, op.fromZ])
  const cyl2 = Manifold.cylinder(h2, radius, radius, RADIAL_SEGMENTS)
    .translate([op.toX, op.toY, op.toZ])

  const result = Manifold.hull([cyl1, cyl2])
  cyl1.delete()
  cyl2.delete()
  return result
}

// ── Core CSG operation ─────────────────────────────────────────────────────

async function doSubtractBatch(
  dims: WorkpieceDims,
  operations: CsgOperationRequest[],
): Promise<{ geometry: SerializedGeometry; elapsedMs: number }> {
  const wasm = await getWasm()
  const start = performance.now()
  const { Manifold } = wasm

  // Create workpiece as native Manifold cube
  // Origin at (0,0), top face at z=0, bottom at z=-thickness
  const wpCube = Manifold.cube([dims.width, dims.height, dims.thickness])
  const wpOriginalID = wpCube.originalID()
  const wpManifold = wpCube.translate([0, 0, -dims.thickness])

  // Build tool Manifold objects using native primitives
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolManifolds: any[] = operations.map((op) => createToolManifold(wasm, op))

  // Union all tool volumes into one Manifold (true boolean union — no internal faces).
  // Manifold.union() batch method is more efficient than sequential .add() calls.
  const toolUnion =
    toolManifolds.length === 1 ? toolManifolds[0] : Manifold.union(toolManifolds)

  // Clean up individual tool manifolds (batch union creates a new object)
  if (toolManifolds.length > 1) {
    for (const m of toolManifolds) m.delete()
  }

  // Boolean difference: workpiece minus tool union
  const result = wpManifold.subtract(toolUnion)
  wpManifold.delete()
  toolUnion.delete()

  // Extract mesh data directly from Manifold (no Three.js needed)
  const mesh = result.getMesh()
  result.delete()

  // Build material groups from Manifold's face provenance.
  // Faces with the workpiece's originalID → material 0 (surface laminate).
  // All other faces (from tool subtraction) → material 1 (exposed core).
  const groups: MaterialGroup[] = []
  const runIndex: Uint32Array = mesh.runIndex
  const runOriginalID: Uint32Array = mesh.runOriginalID

  for (let r = 0; r < runOriginalID.length; r++) {
    const start = runIndex[r]
    const count = runIndex[r + 1] - start
    if (count === 0) continue
    const materialIndex = runOriginalID[r] === wpOriginalID ? 0 : 1
    // Merge consecutive groups with the same material
    const prev = groups.length > 0 ? groups[groups.length - 1] : null
    if (prev && prev.materialIndex === materialIndex && prev.start + prev.count === start) {
      prev.count += count
    } else {
      groups.push({ start, count, materialIndex })
    }
  }

  const serialized: SerializedGeometry = {
    position: new Float32Array(mesh.vertProperties),
    index: new Uint32Array(mesh.triVerts),
    groups,
  }

  return { geometry: serialized, elapsedMs: performance.now() - start }
}

// ── Message handler ────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<ManifoldWorkerRequest>) => {
  const { id, type } = e.data

  try {
    if (type !== 'subtractBatch') return

    const { geometry, elapsedMs } = await doSubtractBatch(
      e.data.workpieceDims,
      e.data.operations,
    )

    const response: ManifoldWorkerResponse = { id, geometry, elapsedMs }
    const transfer: Transferable[] = [geometry.position.buffer]
    if (geometry.index) transfer.push(geometry.index.buffer)

    ;(self as unknown as Worker).postMessage(response, transfer)
  } catch (err) {
    console.error('[Manifold Worker] Error:', err)
    ;(self as unknown as Worker).postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

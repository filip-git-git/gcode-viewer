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
 * Create a flat end mill sweep volume.
 * Vertical plunge → cylinder. Lateral move → convex hull of two cylinders.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createFlatEndMillManifold(wasm: any, op: CsgOperationRequest): any {
  const { Manifold } = wasm
  const radius = op.toolDiameter / 2

  const dx = op.toX - op.fromX
  const dy = op.toY - op.fromY
  const lateralDist = Math.sqrt(dx * dx + dy * dy)

  if (lateralDist < 0.001) {
    const zBottom = Math.min(op.fromZ, op.toZ)
    const zTop = Math.max(op.fromZ, op.toZ) + TOOL_CLEARANCE
    const height = zTop - zBottom
    return Manifold.cylinder(height, radius, radius, RADIAL_SEGMENTS).translate([
      op.fromX,
      op.fromY,
      zBottom,
    ])
  }

  const topZ = TOOL_CLEARANCE
  const h1 = topZ - op.fromZ
  const h2 = topZ - op.toZ

  const cyl1 = Manifold.cylinder(h1, radius, radius, RADIAL_SEGMENTS).translate([
    op.fromX,
    op.fromY,
    op.fromZ,
  ])
  const cyl2 = Manifold.cylinder(h2, radius, radius, RADIAL_SEGMENTS).translate([
    op.toX,
    op.toY,
    op.toZ,
  ])

  const result = Manifold.hull([cyl1, cyl2])
  cyl1.delete()
  cyl2.delete()
  return result
}

/**
 * Create a drill bit sweep volume.
 * Cylinder body + conical tip.
 * Point angle from op.tipAngle (degrees), defaults to 118° standard.
 * Drills are vertical-only operations (no lateral hull).
 *
 * Note: Manifold.cylinder(h, radiusLow=0) is not guaranteed to work since
 * radiusLow "Must be positive" per API docs. We use Manifold.revolve() instead
 * to create the cone from a triangular profile.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDrillManifold(wasm: any, op: CsgOperationRequest): any {
  const { Manifold } = wasm
  const radius = op.toolDiameter / 2

  // Point angle (full angle at tip) → half-angle → tip height
  const pointAngle = op.tipAngle ?? 118
  const halfAngleDeg = pointAngle / 2
  const tipHeight = radius / Math.tan((halfAngleDeg * Math.PI) / 180)

  const zBottom = Math.min(op.fromZ, op.toZ)
  const zTop = Math.max(op.fromZ, op.toZ) + TOOL_CLEARANCE

  // Conical tip: using Manifold.revolve() instead of cylinder(h, 0, r)
  // because cylinder() requires radiusLow > 0 per API docs.
  //
  // Triangle in X-Y plane for revolve:
  // - (0, 0): apex at origin (becomes Y=0 after revolve)
  // - (radius, 0): base point on X-axis at Y=0
  // - (0, tipHeight): height point on Y-axis at Y=tipHeight
  // Polygon must be closed (last point = first point) to create a solid cone.
  // Revolve around Y-axis creates cone with axis along Y, apex at Y=0, base at Y=tipHeight.
  // Cone is pointing in +Y direction (Y+).
  //
  // After rotate(180, 0, 0): Y-axis → -Y axis, so +Y becomes -Y (pointing down).
  const conePolygon = [
    [0, 0],
    [radius, 0],
    [0, tipHeight],
    [0, 0], // close the polygon to create a solid cone, not a shell
  ]
  const cone = Manifold.revolve([conePolygon], RADIAL_SEGMENTS, 360)
    .rotate(180, 0, 0)
    .translate([op.fromX, op.fromY, zBottom])

  // Cylinder body from zBottom to zTop
  const bodyHeight = zTop - zBottom
  const body = Manifold.cylinder(bodyHeight, radius, radius, RADIAL_SEGMENTS).translate([
    op.fromX,
    op.fromY,
    zBottom,
  ])

  // hull() instead of union(): cone+cylinder is convex so hull == union geometrically,
  // but hull avoids the coplanar-face boolean operation where the cone's top and
  // cylinder's bottom share an exact Z=zBottom face — that coplanar union can return
  // an errored Manifold in manifold-3d v3, causing the outer subtraction to fail.
  const result = Manifold.hull([cone, body])

  // Translate the entire result UP by tipHeight to compensate for the cone
  // being positioned with apex at zBottom - tipHeight instead of zBottom
  const resultTranslated = result.translate([0, 0, tipHeight])

  cone.delete()
  body.delete()
  result.delete()
  return resultTranslated
}

/**
 * Create a Forstner bit sweep volume.
 * Flat-bottomed cylinder — no conical tip.
 * Used for shelf-pin holes, hinge pockets, and other flat-bottom bores.
 * Forstner bits are vertical-only operations (no lateral hull).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createForstnerManifold(wasm: any, op: CsgOperationRequest): any {
  const { Manifold } = wasm
  const radius = op.toolDiameter / 2

  const zBottom = Math.min(op.fromZ, op.toZ)
  const zTop = Math.max(op.fromZ, op.toZ) + TOOL_CLEARANCE
  const height = zTop - zBottom

  return Manifold.cylinder(height, radius, radius, RADIAL_SEGMENTS).translate([
    op.fromX,
    op.fromY,
    zBottom,
  ])
}

/**
 * Create a ball end mill sweep volume.
 * Hemisphere cap + cylinder body.
 * Vertical plunge → sphere cap + cylinder.
 * Lateral move → hull of two sphere-capped profiles.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createBallEndMillManifold(wasm: any, op: CsgOperationRequest): any {
  const { Manifold } = wasm
  const radius = op.toolDiameter / 2

  const dx = op.toX - op.fromX
  const dy = op.toY - op.fromY
  const lateralDist = Math.sqrt(dx * dx + dy * dy)

  // Helper: create a ball-end profile at position (x, y, z)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ballProfile(x: number, y: number, z: number): any {
    const zTop = TOOL_CLEARANCE
    const bodyHeight = zTop - z - radius // cylinder from sphere center to top
    // Hemisphere: sphere intersected with upper half-space
    const sphere = Manifold.sphere(radius, RADIAL_SEGMENTS || 24).translate([x, y, z + radius])

    if (bodyHeight <= 0) {
      return sphere
    }

    const body = Manifold.cylinder(bodyHeight, radius, radius, RADIAL_SEGMENTS).translate([
      x,
      y,
      z + radius,
    ])

    const result = Manifold.union([sphere, body])
    sphere.delete()
    body.delete()
    return result
  }

  if (lateralDist < 0.001) {
    // Vertical plunge
    const z = Math.min(op.fromZ, op.toZ)
    return ballProfile(op.fromX, op.fromY, z)
  }

  // Lateral move — hull of two ball-end profiles
  const prof1 = ballProfile(op.fromX, op.fromY, op.fromZ)
  const prof2 = ballProfile(op.toX, op.toY, op.toZ)
  const result = Manifold.hull([prof1, prof2])
  prof1.delete()
  prof2.delete()
  return result
}

/**
 * Create a tool sweep volume using native Manifold primitives.
 * Dispatches to the appropriate geometry builder based on tipType.
 * Caller must call .delete() on the returned Manifold when done.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createToolManifold(wasm: any, op: CsgOperationRequest): any {
  switch (op.tipType) {
    case 'drill':
      return createDrillManifold(wasm, op)
    case 'forstner':
      return createForstnerManifold(wasm, op)
    case 'ball-end-mill':
      return createBallEndMillManifold(wasm, op)
    case 'bull-nose':
      // cornerRadius affects surface finish, not bulk material removal.
      // Geometry identical to flat-end-mill for CSG purposes.
      return createFlatEndMillManifold(wasm, op)
    case 'flat-end-mill':
    default:
      return createFlatEndMillManifold(wasm, op)
  }
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
  const toolUnion = toolManifolds.length === 1 ? toolManifolds[0] : Manifold.union(toolManifolds)

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

  // Guard: getMesh() may return undefined runOriginalID when provenance is unavailable
  for (let r = 0; runOriginalID && runIndex && r < runOriginalID.length; r++) {
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

    const { geometry, elapsedMs } = await doSubtractBatch(e.data.workpieceDims, e.data.operations)

    const response: ManifoldWorkerResponse = { id, geometry, elapsedMs }
    const transfer: Transferable[] = [geometry.position.buffer]
    if (geometry.index) transfer.push(geometry.index.buffer)

    self.postMessage(response, { transfer })
  } catch (err) {
    console.error('[Manifold Worker] Error:', err)
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

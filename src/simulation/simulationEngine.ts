/**
 * Simulation engine — transforms parsed GCode operations into CSG operation requests.
 *
 * Filters operations to only material-removing moves (linear/arc with spindle on),
 * classifies each as 'mill' or 'drill' based on tool tip type, tessellates arcs
 * into linear segments, and resolves tool dimensions from the tool database.
 */

import type { Operation } from '../parser/types'
import type { ToolDefinition } from '../tools/types'
import type {
  CsgOperationRequest,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
} from './types'

/** Chord-error tolerance for arc tessellation (mm) */
const ARC_CHORD_ERROR = 0.1

/**
 * Run the simulation engine on parsed GCode output.
 *
 * @param input - Parsed operations + tool database + optional default workpiece
 * @returns CSG operation requests, warnings, dimensions, and tools used
 */
export function simulate(input: SimulationInput): SimulationResult {
  const { parseResult, tools, defaultWorkpiece } = input
  const { operations, dimensions } = parseResult

  const toolMap = buildToolMap(tools)
  const csgRequests: CsgOperationRequest[] = []
  const warnings: SimulationWarning[] = []
  const toolsUsed = new Set<number>()

  let csgIndex = 0

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]

    if (!isCuttingOperation(op)) continue

    toolsUsed.add(op.toolNumber)

    const tool = toolMap.get(op.toolNumber)
    if (!tool) {
      warnings.push({
        operationIndex: i,
        lineNumber: op.lineNumber,
        message: `Tool T${op.toolNumber} not found in tool database`,
      })
      continue
    }

    // Arc operations: tessellate into linear segments
    if (op.type === 'arc-cw' || op.type === 'arc-ccw') {
      const segments = tessellateArc(op)
      for (const seg of segments) {
        csgRequests.push({
          type: 'mill',
          tipType: tool.tipType,
          fromX: seg.fromX,
          fromY: seg.fromY,
          fromZ: seg.fromZ,
          toX: seg.toX,
          toY: seg.toY,
          toZ: seg.toZ,
          toolNumber: op.toolNumber,
          toolDiameter: tool.diameter,
          operationIndex: csgIndex,
          sourceLineNumber: op.lineNumber,
          tipAngle: tool.tipAngle ?? 118,
        })
        csgIndex++
      }
      continue
    }

    const csgType = classifyOperation(op, tool)

    csgRequests.push({
      type: csgType,
      tipType: tool.tipType,
      fromX: op.fromX,
      fromY: op.fromY,
      fromZ: op.fromZ,
      toX: op.toX,
      toY: op.toY,
      toZ: op.toZ,
      toolNumber: op.toolNumber,
      toolDiameter: tool.diameter,
      operationIndex: csgIndex,
      sourceLineNumber: op.lineNumber,
      tipAngle: tool.tipAngle ?? 118,
    })

    csgIndex++
  }

  return {
    csgRequests,
    warnings,
    dimensions: dimensions ?? defaultWorkpiece ?? null,
    toolsUsed: Array.from(toolsUsed).sort((a, b) => a - b),
  }
}

function buildToolMap(tools: ToolDefinition[]): Map<number, ToolDefinition> {
  const map = new Map<number, ToolDefinition>()
  for (const tool of tools) {
    map.set(tool.toolNumber, tool)
  }
  return map
}

/**
 * Determine if an operation removes material.
 * Linear moves (G1) and arc moves (G2/G3) with spindle running are cutting operations.
 * Rapid moves (G0) are positioning-only.
 */
function isCuttingOperation(op: Operation): boolean {
  return (
    (op.type === 'linear' || op.type === 'arc-cw' || op.type === 'arc-ccw') &&
    op.spindleState !== 'off'
  )
}

interface LinearSegment {
  fromX: number
  fromY: number
  fromZ: number
  toX: number
  toY: number
  toZ: number
}

/**
 * Tessellate an arc operation into linear segments.
 * Uses chord-error tolerance to determine segment count.
 */
export function tessellateArc(op: Operation): LinearSegment[] {
  let centerX: number
  let centerY: number

  if (op.centerI !== undefined && op.centerJ !== undefined) {
    // IJ form: center is offset from start position
    centerX = op.fromX + op.centerI
    centerY = op.fromY + op.centerJ
  } else if (op.radius !== undefined) {
    // R form: compute center from start, end, and radius
    const computed = computeCenterFromRadius(
      op.fromX,
      op.fromY,
      op.toX,
      op.toY,
      op.radius,
      op.type === 'arc-cw',
    )
    centerX = computed.cx
    centerY = computed.cy
  } else {
    // No arc specification — return single linear segment as fallback
    return [
      {
        fromX: op.fromX,
        fromY: op.fromY,
        fromZ: op.fromZ,
        toX: op.toX,
        toY: op.toY,
        toZ: op.toZ,
      },
    ]
  }

  const r = Math.sqrt((op.fromX - centerX) ** 2 + (op.fromY - centerY) ** 2)
  if (r < 1e-6) {
    return [
      {
        fromX: op.fromX,
        fromY: op.fromY,
        fromZ: op.fromZ,
        toX: op.toX,
        toY: op.toY,
        toZ: op.toZ,
      },
    ]
  }

  let startAngle = Math.atan2(op.fromY - centerY, op.fromX - centerX)
  let endAngle = Math.atan2(op.toY - centerY, op.toX - centerX)

  // Compute sweep angle based on direction
  let sweep: number
  if (op.type === 'arc-cw') {
    // Clockwise: negative sweep
    sweep = endAngle - startAngle
    if (sweep >= 0) sweep -= 2 * Math.PI
    // Full circle: start == end
    if (Math.abs(op.fromX - op.toX) < 1e-6 && Math.abs(op.fromY - op.toY) < 1e-6) {
      sweep = -2 * Math.PI
    }
  } else {
    // Counter-clockwise: positive sweep
    sweep = endAngle - startAngle
    if (sweep <= 0) sweep += 2 * Math.PI
    // Full circle
    if (Math.abs(op.fromX - op.toX) < 1e-6 && Math.abs(op.fromY - op.toY) < 1e-6) {
      sweep = 2 * Math.PI
    }
  }

  // Segment count from chord-error tolerance
  // chord error = r * (1 - cos(theta/2)), solve for theta: theta = 2 * acos(1 - error/r)
  const maxAnglePerSegment =
    ARC_CHORD_ERROR >= r ? Math.PI / 4 : 2 * Math.acos(1 - ARC_CHORD_ERROR / r)
  const numSegments = Math.max(2, Math.ceil(Math.abs(sweep) / maxAnglePerSegment))

  // Z interpolation (helical arcs)
  const zDelta = op.toZ - op.fromZ
  const segments: LinearSegment[] = []

  for (let i = 0; i < numSegments; i++) {
    const t0 = i / numSegments
    const t1 = (i + 1) / numSegments
    const a0 = startAngle + sweep * t0
    const a1 = startAngle + sweep * t1

    segments.push({
      fromX: centerX + r * Math.cos(a0),
      fromY: centerY + r * Math.sin(a0),
      fromZ: op.fromZ + zDelta * t0,
      toX: centerX + r * Math.cos(a1),
      toY: centerY + r * Math.sin(a1),
      toZ: op.fromZ + zDelta * t1,
    })
  }

  return segments
}

/**
 * Compute arc center from start point, end point, and radius (R-form).
 * Convention: positive R = shorter arc, negative R = longer arc.
 */
function computeCenterFromRadius(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  clockwise: boolean,
): { cx: number; cy: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const d = Math.sqrt(dx * dx + dy * dy)

  const absR = Math.abs(r)
  // Clamp h² to avoid NaN from floating point
  const hSq = Math.max(0, absR * absR - (d / 2) ** 2)
  const h = Math.sqrt(hSq)

  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2

  // Perpendicular direction
  const px = -dy / d
  const py = dx / d

  // Choose side based on direction and R sign
  const sign = clockwise !== r < 0 ? 1 : -1

  return {
    cx: mx + sign * h * px,
    cy: my + sign * h * py,
  }
}

/**
 * Classify a cutting operation as 'mill' or 'drill' based on tool type and movement.
 * - Drill tools with purely vertical movement → 'drill'
 * - Everything else → 'mill'
 */
function classifyOperation(op: Operation, tool: ToolDefinition): 'mill' | 'drill' {
  if ((tool.tipType === 'drill' || tool.tipType === 'forstner') && isPurelyVertical(op)) {
    return 'drill'
  }
  return 'mill'
}

function isPurelyVertical(op: Operation): boolean {
  return op.fromX === op.toX && op.fromY === op.toY && op.fromZ !== op.toZ
}

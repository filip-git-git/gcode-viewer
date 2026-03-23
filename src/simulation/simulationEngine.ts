/**
 * Simulation engine — transforms parsed GCode operations into CSG operation requests.
 *
 * Filters operations to only material-removing moves (linear with spindle on),
 * classifies each as 'mill' or 'drill' based on tool tip type, and resolves
 * tool dimensions from the tool database.
 */

import type { Operation } from '../parser/types'
import type { ToolDefinition } from '../tools/types'
import type {
  CsgOperationRequest,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
} from './types'

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

    const csgType = classifyOperation(op, tool)

    csgRequests.push({
      type: csgType,
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
 * Only linear moves (G1) with spindle running are cutting operations.
 * Rapid moves (G0) are positioning-only.
 */
function isCuttingOperation(op: Operation): boolean {
  return op.type === 'linear' && op.spindleState !== 'off'
}

/**
 * Classify a cutting operation as 'mill' or 'drill' based on tool type and movement.
 * - Drill tools with purely vertical movement → 'drill'
 * - Everything else → 'mill'
 */
function classifyOperation(op: Operation, tool: ToolDefinition): 'mill' | 'drill' {
  if (tool.tipType === 'drill' && isPurelyVertical(op)) {
    return 'drill'
  }
  return 'mill'
}

function isPurelyVertical(op: Operation): boolean {
  return op.fromX === op.toX && op.fromY === op.toY && op.fromZ !== op.toZ
}

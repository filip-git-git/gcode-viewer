/**
 * Tool database — localStorage-backed CRUD service for ToolDefinition[].
 */

import type { ToolDefinition, TipType } from './types'

const STORAGE_KEY = 'gcode-viewer-tools'

const VALID_TIP_TYPES: TipType[] = ['flat-end-mill', 'ball-end-mill', 'drill']

/** Default tool library shipped with the application. */
export const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    toolNumber: 1,
    name: '6mm Flat End Mill',
    diameter: 6,
    tipType: 'flat-end-mill',
    cuttingLength: 25,
  },
  {
    toolNumber: 2,
    name: '8mm Flat End Mill',
    diameter: 8,
    tipType: 'flat-end-mill',
    cuttingLength: 30,
  },
  {
    toolNumber: 3,
    name: '5mm Drill',
    diameter: 5,
    tipType: 'drill',
    cuttingLength: 40,
  },
]

/** Validation error for a tool definition. */
export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolValidationError'
  }
}

/** Validate a single tool definition. Throws ToolValidationError on failure. */
export function validateTool(tool: unknown): asserts tool is ToolDefinition {
  if (typeof tool !== 'object' || tool === null) {
    throw new ToolValidationError('Tool must be an object')
  }

  const t = tool as Record<string, unknown>

  if (typeof t.toolNumber !== 'number' || t.toolNumber <= 0 || !Number.isInteger(t.toolNumber)) {
    throw new ToolValidationError('toolNumber must be a positive integer')
  }
  if (typeof t.name !== 'string' || t.name.trim() === '') {
    throw new ToolValidationError('name must be a non-empty string')
  }
  if (typeof t.diameter !== 'number' || t.diameter <= 0) {
    throw new ToolValidationError('diameter must be a positive number')
  }
  if (!VALID_TIP_TYPES.includes(t.tipType as TipType)) {
    throw new ToolValidationError(
      `tipType must be one of: ${VALID_TIP_TYPES.join(', ')}`,
    )
  }
  if (typeof t.cuttingLength !== 'number' || t.cuttingLength <= 0) {
    throw new ToolValidationError('cuttingLength must be a positive number')
  }
}

/** Read raw data from localStorage and parse. Returns null on any failure. */
function readStorage(): ToolDefinition[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    // Validate every entry
    for (const item of parsed) {
      validateTool(item)
    }
    return parsed as ToolDefinition[]
  } catch {
    // Corruption detected — will be recovered by caller
    return null
  }
}

/** Write tools array to localStorage. */
function writeStorage(tools: ToolDefinition[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tools))
}

/**
 * Get all tools from the database.
 * If localStorage is empty or corrupted, resets to defaults.
 */
export function getAllTools(): ToolDefinition[] {
  const stored = readStorage()
  if (stored !== null) return stored

  // First access or corruption — seed with defaults
  console.warn('[tools] localStorage empty or corrupted — restoring defaults')
  writeStorage(DEFAULT_TOOLS)
  return [...DEFAULT_TOOLS]
}

/** Get a tool by its tool number, or undefined if not found. */
export function getToolByNumber(toolNumber: number): ToolDefinition | undefined {
  return getAllTools().find((t) => t.toolNumber === toolNumber)
}

/**
 * Save (add or update) a tool definition.
 * Validates the tool before saving. Throws ToolValidationError on invalid input.
 */
export function saveTool(tool: ToolDefinition): void {
  validateTool(tool)
  const tools = getAllTools()
  const idx = tools.findIndex((t) => t.toolNumber === tool.toolNumber)
  if (idx >= 0) {
    tools[idx] = tool
  } else {
    tools.push(tool)
  }
  writeStorage(tools)
}

/** Remove a tool by tool number. Returns true if removed, false if not found. */
export function removeTool(toolNumber: number): boolean {
  const tools = getAllTools()
  const idx = tools.findIndex((t) => t.toolNumber === toolNumber)
  if (idx < 0) return false
  tools.splice(idx, 1)
  writeStorage(tools)
  return true
}

/** Reset tool database to factory defaults. */
export function resetToDefaults(): void {
  writeStorage(DEFAULT_TOOLS)
}

/** Clear all tools (empty database). */
export function clearAllTools(): void {
  writeStorage([])
}

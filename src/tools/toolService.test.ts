import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAllTools,
  getToolByNumber,
  saveTool,
  removeTool,
  resetToDefaults,
  clearAllTools,
  validateTool,
  ToolValidationError,
  DEFAULT_TOOLS,
} from './toolService'

// ── localStorage mock ────────────────────────────────────────────

const storage = new Map<string, string>()

const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size
  },
  key: vi.fn((_index: number) => null),
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
})

// ── Validation ───────────────────────────────────────────────────

describe('validateTool', () => {
  it('accepts a valid tool', () => {
    expect(() => validateTool(DEFAULT_TOOLS[0])).not.toThrow()
  })

  it('rejects non-object', () => {
    expect(() => validateTool(null)).toThrow(ToolValidationError)
    expect(() => validateTool('string')).toThrow(ToolValidationError)
  })

  it('rejects toolNumber <= 0', () => {
    expect(() =>
      validateTool({ ...DEFAULT_TOOLS[0], toolNumber: 0 }),
    ).toThrow('positive integer')
  })

  it('rejects non-integer toolNumber', () => {
    expect(() =>
      validateTool({ ...DEFAULT_TOOLS[0], toolNumber: 1.5 }),
    ).toThrow('positive integer')
  })

  it('rejects empty name', () => {
    expect(() => validateTool({ ...DEFAULT_TOOLS[0], name: '' })).toThrow(
      'non-empty',
    )
  })

  it('rejects diameter <= 0', () => {
    expect(() =>
      validateTool({ ...DEFAULT_TOOLS[0], diameter: -1 }),
    ).toThrow('positive')
  })

  it('rejects invalid tipType', () => {
    expect(() =>
      validateTool({ ...DEFAULT_TOOLS[0], tipType: 'laser' }),
    ).toThrow('tipType')
  })

  it('rejects cuttingLength <= 0', () => {
    expect(() =>
      validateTool({ ...DEFAULT_TOOLS[0], cuttingLength: 0 }),
    ).toThrow('positive')
  })
})

// ── CRUD operations ──────────────────────────────────────────────

describe('getAllTools', () => {
  it('returns defaults on first access (empty localStorage)', () => {
    const tools = getAllTools()
    expect(tools).toEqual(DEFAULT_TOOLS)
    expect(localStorageMock.setItem).toHaveBeenCalled()
  })

  it('returns stored tools on subsequent access', () => {
    const custom = [{ ...DEFAULT_TOOLS[0], name: 'Custom Mill' }]
    storage.set('gcode-viewer-tools', JSON.stringify(custom))

    const tools = getAllTools()
    expect(tools[0].name).toBe('Custom Mill')
  })
})

describe('getToolByNumber', () => {
  it('finds tool by number', () => {
    getAllTools() // seed defaults
    const tool = getToolByNumber(1)
    expect(tool).toBeDefined()
    expect(tool!.name).toBe('6mm Flat End Mill')
  })

  it('returns undefined for non-existent tool', () => {
    getAllTools()
    expect(getToolByNumber(99)).toBeUndefined()
  })
})

describe('saveTool', () => {
  it('adds a new tool', () => {
    getAllTools() // seed
    saveTool({
      toolNumber: 10,
      name: '10mm Ball Mill',
      diameter: 10,
      tipType: 'ball-end-mill',
      cuttingLength: 35,
    })
    expect(getToolByNumber(10)).toBeDefined()
    expect(getAllTools().length).toBe(DEFAULT_TOOLS.length + 1)
  })

  it('updates existing tool by toolNumber', () => {
    getAllTools()
    saveTool({ ...DEFAULT_TOOLS[0], name: 'Updated Mill' })
    expect(getToolByNumber(1)!.name).toBe('Updated Mill')
    expect(getAllTools().length).toBe(DEFAULT_TOOLS.length)
  })

  it('rejects invalid tool', () => {
    expect(() =>
      saveTool({
        toolNumber: -1,
        name: 'Bad',
        diameter: 5,
        tipType: 'drill',
        cuttingLength: 10,
      }),
    ).toThrow(ToolValidationError)
  })
})

describe('removeTool', () => {
  it('removes existing tool and returns true', () => {
    getAllTools()
    const result = removeTool(1)
    expect(result).toBe(true)
    expect(getToolByNumber(1)).toBeUndefined()
  })

  it('returns false for non-existent tool', () => {
    getAllTools()
    expect(removeTool(99)).toBe(false)
  })
})

describe('resetToDefaults', () => {
  it('restores default tools', () => {
    getAllTools()
    saveTool({
      toolNumber: 50,
      name: 'Extra',
      diameter: 12,
      tipType: 'drill',
      cuttingLength: 20,
    })
    resetToDefaults()
    expect(getAllTools()).toEqual(DEFAULT_TOOLS)
  })
})

describe('clearAllTools', () => {
  it('empties the tool database', () => {
    getAllTools()
    clearAllTools()
    // After clear, getAllTools should detect empty array as valid (not corruption)
    const raw = storage.get('gcode-viewer-tools')
    expect(raw).toBe('[]')
  })
})

// ── Corruption recovery ──────────────────────────────────────────

describe('corruption recovery', () => {
  it('recovers from invalid JSON', () => {
    storage.set('gcode-viewer-tools', '{not valid json!!')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const tools = getAllTools()
    expect(tools).toEqual(DEFAULT_TOOLS)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('corrupted'),
    )
    warnSpy.mockRestore()
  })

  it('recovers from non-array JSON', () => {
    storage.set('gcode-viewer-tools', '{"not": "an array"}')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const tools = getAllTools()
    expect(tools).toEqual(DEFAULT_TOOLS)
    warnSpy.mockRestore()
  })

  it('recovers from array with invalid tool entries', () => {
    storage.set(
      'gcode-viewer-tools',
      JSON.stringify([{ toolNumber: -1, garbage: true }]),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const tools = getAllTools()
    expect(tools).toEqual(DEFAULT_TOOLS)
    warnSpy.mockRestore()
  })
})

import { describe, it, expect } from 'vitest'
import { simulate, tessellateArc } from './simulationEngine'
import { parseGCode } from '../parser/parser'
import type { ToolDefinition } from '../tools/types'
import type { SimulationInput } from './types'
import type { Operation } from '../parser/types'

// ── Test fixtures ────────────────────────────────────────────────

const FLAT_END_MILL: ToolDefinition = {
  toolNumber: 1,
  name: '10mm flat end mill',
  diameter: 10,
  tipType: 'flat-end-mill',
  cuttingLength: 30,
}

const DRILL_BIT: ToolDefinition = {
  toolNumber: 2,
  name: '8mm drill',
  diameter: 8,
  tipType: 'drill',
  cuttingLength: 40,
}

const BALL_END_MILL: ToolDefinition = {
  toolNumber: 3,
  name: '6mm ball end mill',
  diameter: 6,
  tipType: 'ball-end-mill',
  cuttingLength: 25,
}

const ALL_TOOLS = [FLAT_END_MILL, DRILL_BIT, BALL_END_MILL]

function makeInput(gcode: string, tools: ToolDefinition[] = ALL_TOOLS): SimulationInput {
  return {
    parseResult: parseGCode(gcode),
    tools,
  }
}

// ── Basic operation filtering ────────────────────────────────────

describe('simulate — operation filtering', () => {
  it('ignores rapid moves (G0)', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X100 Y100 Z5
M5
M30
`),
    )
    expect(result.csgRequests).toHaveLength(0)
  })

  it('ignores linear moves with spindle off', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
G1 X100 Y100 Z-5 F3000
M30
`),
    )
    expect(result.csgRequests).toHaveLength(0)
  })

  it('produces CSG request for linear move with spindle on', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X50 Y50 Z5
G1 Z-8 F3000
M5
M30
`),
    )
    expect(result.csgRequests).toHaveLength(1)
    expect(result.csgRequests[0].type).toBe('mill')
  })

  it('ignores spindle, tool-change, and program-end operations', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
M5
M30
`),
    )
    expect(result.csgRequests).toHaveLength(0)
  })
})

// ── Coordinate mapping ───────────────────────────────────────────

describe('simulate — coordinate mapping', () => {
  it('maps from/to coordinates correctly', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y20 Z5
G1 Z-5 F3000
G1 X100 F5000
M5
M30
`),
    )

    expect(result.csgRequests).toHaveLength(2)

    const plunge = result.csgRequests[0]
    expect(plunge.fromX).toBe(10)
    expect(plunge.fromY).toBe(20)
    expect(plunge.fromZ).toBe(5)
    expect(plunge.toX).toBe(10)
    expect(plunge.toY).toBe(20)
    expect(plunge.toZ).toBe(-5)

    const cut = result.csgRequests[1]
    expect(cut.fromX).toBe(10)
    expect(cut.fromY).toBe(20)
    expect(cut.fromZ).toBe(-5)
    expect(cut.toX).toBe(100)
    expect(cut.toY).toBe(20)
    expect(cut.toZ).toBe(-5)
  })

  it('handles incremental positioning (G91)', () => {
    const result = simulate(
      makeInput(`
G91
T1 M6
M3 S18000
G0 X10 Y20 Z5
G1 Z-10 F3000
G1 X50 F5000
M5
M30
`),
    )

    expect(result.csgRequests).toHaveLength(2)

    const plunge = result.csgRequests[0]
    expect(plunge.fromZ).toBe(5)
    expect(plunge.toZ).toBe(-5)

    const cut = result.csgRequests[1]
    expect(cut.fromX).toBe(10)
    expect(cut.toX).toBe(60)
  })
})

// ── Tool classification ──────────────────────────────────────────

describe('simulate — tool classification', () => {
  it('classifies flat end mill moves as mill', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
G1 X100 F5000
M5
M30
`),
    )

    expect(result.csgRequests.every((r) => r.type === 'mill')).toBe(true)
  })

  it('propagates tipType from tool definition', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
G1 X100 F5000
M5
T2 M6
M3 S12000
G0 X50 Y50 Z5
G1 Z-20 F1500
M5
T3 M6
M3 S15000
G0 X20 Y20 Z5
G1 Z-3 F2000
M5
M30
`),
    )

    const flatOps = result.csgRequests.filter((r) => r.tipType === 'flat-end-mill')
    const drillOps = result.csgRequests.filter((r) => r.tipType === 'drill')
    const ballOps = result.csgRequests.filter((r) => r.tipType === 'ball-end-mill')

    expect(flatOps.length).toBeGreaterThan(0)
    expect(drillOps.length).toBeGreaterThan(0)
    expect(ballOps.length).toBeGreaterThan(0)
  })

  it('classifies drill vertical-only move as drill', () => {
    const result = simulate(
      makeInput(`
G90
T2 M6
M3 S12000
G0 X50 Y50 Z5
G1 Z-20 F1500
M5
M30
`),
    )

    expect(result.csgRequests).toHaveLength(1)
    expect(result.csgRequests[0].type).toBe('drill')
  })

  it('classifies drill lateral move as mill (not drill)', () => {
    const result = simulate(
      makeInput(`
G90
T2 M6
M3 S12000
G0 X50 Y50 Z-5
G1 X100 F1500
M5
M30
`),
    )

    expect(result.csgRequests).toHaveLength(1)
    expect(result.csgRequests[0].type).toBe('mill')
  })

  it('classifies ball end mill moves as mill', () => {
    const result = simulate(
      makeInput(`
G90
T3 M6
M3 S15000
G0 X10 Y10 Z5
G1 Z-3 F2000
G1 X80 F4000
M5
M30
`),
    )

    expect(result.csgRequests.every((r) => r.type === 'mill')).toBe(true)
  })
})

// ── Tool resolution ──────────────────────────────────────────────

describe('simulate — tool resolution', () => {
  it('resolves tool diameter from tool database', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
M5
M30
`),
    )

    expect(result.csgRequests[0].toolDiameter).toBe(10)
    expect(result.csgRequests[0].toolNumber).toBe(1)
  })

  it('warns when tool is not in database', () => {
    const result = simulate(
      makeInput(
        `
G90
T99 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
M5
M30
`,
        [FLAT_END_MILL],
      ),
    )

    expect(result.csgRequests).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('T99')
    expect(result.warnings[0].message).toContain('not found')
  })

  it('tracks tools used', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
G0 Z10
T2 M6
G0 X50 Y50 Z5
G1 Z-20 F1500
M5
M30
`),
    )

    expect(result.toolsUsed).toEqual([1, 2])
  })
})

// ── Workpiece dimensions ─────────────────────────────────────────

describe('simulate — workpiece dimensions', () => {
  it('extracts dimensions from parsed GCode comments', () => {
    const result = simulate(
      makeInput(`
; 800x500x18
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
M5
M30
`),
    )

    expect(result.dimensions).toEqual({ width: 800, height: 500, thickness: 18 })
  })

  it('uses defaultWorkpiece when no dimensions in GCode', () => {
    const result = simulate({
      parseResult: parseGCode(`
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
M5
M30
`),
      tools: ALL_TOOLS,
      defaultWorkpiece: { width: 600, height: 400, thickness: 19 },
    })

    expect(result.dimensions).toEqual({ width: 600, height: 400, thickness: 19 })
  })

  it('returns null when no dimensions available', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
M5
M30
`),
    )

    expect(result.dimensions).toBeNull()
  })
})

// ── CSG request indexing ─────────────────────────────────────────

describe('simulate — indexing and ordering', () => {
  it('assigns sequential operationIndex to CSG requests', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
G1 X100 F5000
G1 Y100
G1 X10
M5
M30
`),
    )

    expect(result.csgRequests).toHaveLength(4)
    expect(result.csgRequests.map((r) => r.operationIndex)).toEqual([0, 1, 2, 3])
  })

  it('preserves source line numbers', () => {
    const result = simulate(
      makeInput(`G90
T1 M6
M3 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
G1 X100 F5000
M5
M30`),
    )

    expect(result.csgRequests[0].sourceLineNumber).toBe(5)
    expect(result.csgRequests[1].sourceLineNumber).toBe(6)
  })
})

// ── Multi-tool program ───────────────────────────────────────────

describe('simulate — multi-tool program', () => {
  it('handles tool changes and produces correct requests', () => {
    const result = simulate(
      makeInput(`
; 800x500x18
G90 G17 G21
T1 M6
M3 S18000
G0 X50 Y50 Z5
G1 Z-8 F3000
G1 X200 F5000
G1 Y150
G1 X50
G1 Y50
G0 Z5
M5
T2 M6
M3 S12000
G0 X100 Y100 Z5
G1 Z-15 F1500
G0 Z5
G0 X200 Y200
G1 Z-15 F1500
G0 Z5
M5
M30
`),
    )

    // 5 mill ops (plunge + 4 sides of rectangle) + 2 drill ops
    expect(result.csgRequests).toHaveLength(7)

    const millOps = result.csgRequests.filter((r) => r.type === 'mill')
    const drillOps = result.csgRequests.filter((r) => r.type === 'drill')

    expect(millOps).toHaveLength(5)
    expect(drillOps).toHaveLength(2)

    expect(millOps.every((r) => r.toolDiameter === 10)).toBe(true)
    expect(drillOps.every((r) => r.toolDiameter === 8)).toBe(true)

    expect(result.toolsUsed).toEqual([1, 2])
    expect(result.dimensions).toEqual({ width: 800, height: 500, thickness: 18 })
  })
})

// ── Edge cases ───────────────────────────────────────────────────

describe('simulate — edge cases', () => {
  it('handles empty GCode', () => {
    const result = simulate(makeInput(''))
    expect(result.csgRequests).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.toolsUsed).toHaveLength(0)
  })

  it('handles GCode with only comments', () => {
    const result = simulate(
      makeInput(`
; This is a comment
; 800x500x18
; Another comment
`),
    )
    expect(result.csgRequests).toHaveLength(0)
    expect(result.dimensions).toEqual({ width: 800, height: 500, thickness: 18 })
  })

  it('handles GCode with no cutting operations', () => {
    const result = simulate(
      makeInput(`
G90
G0 X100 Y100 Z5
G0 X0 Y0 Z0
M30
`),
    )
    expect(result.csgRequests).toHaveLength(0)
  })

  it('handles counterclockwise spindle as cutting', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M4 S18000
G0 X10 Y10 Z5
G1 Z-5 F3000
M5
M30
`),
    )
    expect(result.csgRequests).toHaveLength(1)
  })
})

// ── Arc tessellation ────────────────────────────────────────────

describe('tessellateArc', () => {
  const makeArcOp = (overrides: Partial<Operation>): Operation => ({
    type: 'arc-cw',
    fromX: 10,
    fromY: 0,
    fromZ: -5,
    toX: 0,
    toY: 10,
    toZ: -5,
    feedRate: 1000,
    toolNumber: 1,
    spindleState: 'cw',
    spindleSpeed: 18000,
    lineNumber: 1,
    centerI: -10,
    centerJ: 0,
    ...overrides,
  })

  it('produces multiple linear segments for a 90-degree arc', () => {
    // Arc from (10,0) to (0,10) around center (0,0), radius 10, CW
    const op = makeArcOp({
      fromX: 10,
      fromY: 0,
      toX: 0,
      toY: 10,
      centerI: -10,
      centerJ: 0,
    })
    const segments = tessellateArc(op)
    expect(segments.length).toBeGreaterThanOrEqual(2)
    expect(segments.length).toBeLessThanOrEqual(200)

    // First segment starts at arc start
    expect(segments[0].fromX).toBeCloseTo(10, 1)
    expect(segments[0].fromY).toBeCloseTo(0, 1)

    // Last segment ends at arc end
    const last = segments[segments.length - 1]
    expect(last.toX).toBeCloseTo(0, 1)
    expect(last.toY).toBeCloseTo(10, 1)
  })

  it('full circle (start == end) produces closed arc', () => {
    const op = makeArcOp({
      fromX: 10,
      fromY: 0,
      toX: 10,
      toY: 0,
      centerI: -10,
      centerJ: 0,
    })
    const segments = tessellateArc(op)
    expect(segments.length).toBeGreaterThanOrEqual(10)

    // Last segment ends at start
    const last = segments[segments.length - 1]
    expect(last.toX).toBeCloseTo(10, 1)
    expect(last.toY).toBeCloseTo(0, 1)
  })

  it('CCW arc produces segments in opposite direction', () => {
    const cwOp = makeArcOp({
      type: 'arc-cw',
      fromX: 10,
      fromY: 0,
      toX: 0,
      toY: 10,
      centerI: -10,
      centerJ: 0,
    })
    const ccwOp = makeArcOp({
      type: 'arc-ccw',
      fromX: 10,
      fromY: 0,
      toX: 0,
      toY: 10,
      centerI: -10,
      centerJ: 0,
    })

    const cwSegs = tessellateArc(cwOp)
    const ccwSegs = tessellateArc(ccwOp)

    // Both start and end at same points but sweep different directions
    expect(cwSegs[0].fromX).toBeCloseTo(ccwSegs[0].fromX, 1)
    expect(cwSegs[cwSegs.length - 1].toX).toBeCloseTo(ccwSegs[ccwSegs.length - 1].toX, 1)

    // CW long arc (270°) vs CCW short arc (90°) — CW should have more segments
    expect(cwSegs.length).toBeGreaterThan(ccwSegs.length)
  })

  it('R-form arc produces valid segments', () => {
    const {
      centerI: _ci,
      centerJ: _cj,
      ...op
    } = makeArcOp({
      fromX: 0,
      fromY: 0,
      toX: 10,
      toY: 10,
      radius: 10,
    })
    const segments = tessellateArc(op)
    expect(segments.length).toBeGreaterThanOrEqual(2)
    expect(segments[0].fromX).toBeCloseTo(0, 1)
    expect(segments[0].fromY).toBeCloseTo(0, 1)
    const last = segments[segments.length - 1]
    expect(last.toX).toBeCloseTo(10, 1)
    expect(last.toY).toBeCloseTo(10, 1)
  })

  it('preserves Z across flat arc', () => {
    const op = makeArcOp({
      fromZ: -3,
      toZ: -3,
    })
    const segments = tessellateArc(op)
    for (const seg of segments) {
      expect(seg.fromZ).toBeCloseTo(-3, 5)
      expect(seg.toZ).toBeCloseTo(-3, 5)
    }
  })

  it('interpolates Z for helical arc', () => {
    const op = makeArcOp({
      fromZ: 0,
      toZ: -10,
    })
    const segments = tessellateArc(op)
    // First segment starts at Z=0
    expect(segments[0].fromZ).toBeCloseTo(0, 3)
    // Last segment ends at Z=-10
    expect(segments[segments.length - 1].toZ).toBeCloseTo(-10, 3)
    // Z decreases monotonically
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].fromZ).toBeLessThanOrEqual(segments[i - 1].toZ + 0.001)
    }
  })

  it('segments are connected end-to-end', () => {
    const op = makeArcOp({})
    const segments = tessellateArc(op)
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].fromX).toBeCloseTo(segments[i - 1].toX, 5)
      expect(segments[i].fromY).toBeCloseTo(segments[i - 1].toY, 5)
      expect(segments[i].fromZ).toBeCloseTo(segments[i - 1].toZ, 5)
    }
  })
})

// ── Arc simulation integration ──────────────────────────────────

describe('simulate — arc operations', () => {
  it('G2 arc produces linear CSG segments', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y0 Z-5
G2 X0 Y10 I-10 J0 F1000
M5
M30
`),
    )
    // Arc tessellated into multiple linear segments
    expect(result.csgRequests.length).toBeGreaterThanOrEqual(2)
    expect(result.csgRequests.every((r) => r.type === 'mill')).toBe(true)
    expect(result.csgRequests.every((r) => r.tipType === 'flat-end-mill')).toBe(true)
  })

  it('G3 arc produces linear CSG segments', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
M3 S18000
G0 X10 Y0 Z-5
G3 X0 Y10 I-10 J0 F1000
M5
M30
`),
    )
    expect(result.csgRequests.length).toBeGreaterThanOrEqual(2)
  })

  it('arc operations are not produced when spindle is off', () => {
    const result = simulate(
      makeInput(`
G90
T1 M6
G0 X10 Y0 Z-5
G2 X0 Y10 I-10 J0 F1000
M30
`),
    )
    expect(result.csgRequests).toHaveLength(0)
  })
})

// ── Drilling cycle simulation ───────────────────────────────────

describe('simulate — drilling cycles', () => {
  it('G81 produces drill CSG request', () => {
    const result = simulate(
      makeInput(`
G90
T2 M6
M3 S12000
G81 X50 Y50 Z-15 R2 F300
M5
M30
`),
    )
    expect(result.csgRequests).toHaveLength(1)
    expect(result.csgRequests[0].type).toBe('drill')
    expect(result.csgRequests[0].toolDiameter).toBe(8)
    expect(result.csgRequests[0].fromZ).toBe(2)
    expect(result.csgRequests[0].toZ).toBe(-15)
  })

  it('G81 modal repeat produces multiple drill requests', () => {
    const result = simulate(
      makeInput(`
G90
T2 M6
M3 S12000
G81 X10 Y10 Z-15 R2 F300
X20 Y20
X30 Y30
G80
M5
M30
`),
    )
    expect(result.csgRequests).toHaveLength(3)
    expect(result.csgRequests.every((r) => r.type === 'drill')).toBe(true)
    expect(result.csgRequests[0].fromX).toBe(10)
    expect(result.csgRequests[1].fromX).toBe(20)
    expect(result.csgRequests[2].fromX).toBe(30)
  })

  it('G83 peck drill produces single full-depth CSG request', () => {
    const result = simulate(
      makeInput(`
G90
T2 M6
M3 S12000
G83 X50 Y50 Z-15 R2 Q5 F300
M5
M30
`),
    )
    expect(result.csgRequests).toHaveLength(1)
    expect(result.csgRequests[0].type).toBe('drill')
    expect(result.csgRequests[0].toZ).toBe(-15)
  })
})

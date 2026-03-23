/**
 * Command handler registry — maps G/M codes to handler functions.
 *
 * Each handler receives the token list and current machine state,
 * and returns zero or more operations plus the next machine state.
 */

import type {
  ParsedToken,
  MachineState,
  Operation,
  MotionMode,
} from './types'

export interface HandlerResult {
  operations: Operation[]
  nextState: MachineState
}

export type CommandHandler = (
  tokens: ParsedToken[],
  state: MachineState,
  lineNumber: number,
) => HandlerResult

// ── Helpers ──────────────────────────────────────────────────────

function findValue(tokens: ParsedToken[], letter: string): number | undefined {
  const t = tokens.find((tok) => tok.letter === letter)
  return t?.value
}

function makeOperation(
  type: Operation['type'],
  state: MachineState,
  toX: number,
  toY: number,
  toZ: number,
  lineNumber: number,
  feedRate?: number,
): Operation {
  return {
    type,
    fromX: state.x,
    fromY: state.y,
    fromZ: state.z,
    toX,
    toY,
    toZ,
    feedRate: feedRate ?? state.feedRate,
    toolNumber: state.activeTool,
    spindleState: state.spindleState,
    spindleSpeed: state.spindleSpeed,
    lineNumber,
  }
}

// ── Motion handlers ──────────────────────────────────────────────

function handleMotion(
  mode: MotionMode,
  type: Operation['type'],
  tokens: ParsedToken[],
  state: MachineState,
  lineNumber: number,
): HandlerResult {
  const newFeed = findValue(tokens, 'F')
  const feed = newFeed ?? state.feedRate

  let toX: number, toY: number, toZ: number

  if (state.positioningMode === 'G91') {
    // Incremental: values are offsets from current position
    toX = state.x + (findValue(tokens, 'X') ?? 0)
    toY = state.y + (findValue(tokens, 'Y') ?? 0)
    toZ = state.z + (findValue(tokens, 'Z') ?? 0)
  } else {
    // Absolute: values are target positions (missing = keep current)
    toX = findValue(tokens, 'X') ?? state.x
    toY = findValue(tokens, 'Y') ?? state.y
    toZ = findValue(tokens, 'Z') ?? state.z
  }

  const nextState: MachineState = {
    ...state,
    motionMode: mode,
    x: toX,
    y: toY,
    z: toZ,
    feedRate: feed,
  }

  // Only emit operation if position actually changes
  if (toX === state.x && toY === state.y && toZ === state.z) {
    return { operations: [], nextState }
  }

  const op = makeOperation(type, state, toX, toY, toZ, lineNumber, feed)
  return { operations: [op], nextState }
}

// ── Handler registry ─────────────────────────────────────────────

const gCodeHandlers = new Map<number, CommandHandler>()
const mCodeHandlers = new Map<number, CommandHandler>()

// G0 — Rapid positioning
gCodeHandlers.set(0, (tokens, state, ln) =>
  handleMotion('G0', 'rapid', tokens, state, ln),
)

// G1 — Linear interpolation
gCodeHandlers.set(1, (tokens, state, ln) =>
  handleMotion('G1', 'linear', tokens, state, ln),
)

// G17 — XY plane select (default, no-op for now)
gCodeHandlers.set(17, (_tokens, state) => ({
  operations: [],
  nextState: state,
}))

// G20 — Inches (no-op, we assume mm)
gCodeHandlers.set(20, (_tokens, state) => ({
  operations: [],
  nextState: state,
}))

// G21 — Millimeters (default, no-op)
gCodeHandlers.set(21, (_tokens, state) => ({
  operations: [],
  nextState: state,
}))

// G90 — Absolute positioning
gCodeHandlers.set(90, (_tokens, state) => ({
  operations: [],
  nextState: { ...state, positioningMode: 'G90' },
}))

// G91 — Incremental positioning
gCodeHandlers.set(91, (_tokens, state) => ({
  operations: [],
  nextState: { ...state, positioningMode: 'G91' },
}))

// M3 — Spindle on (clockwise)
mCodeHandlers.set(3, (tokens, state, ln) => {
  const speed = findValue(tokens, 'S') ?? state.spindleSpeed
  const nextState: MachineState = {
    ...state,
    spindleState: 'cw',
    spindleSpeed: speed,
  }
  const op: Operation = {
    type: 'spindle',
    fromX: state.x,
    fromY: state.y,
    fromZ: state.z,
    toX: state.x,
    toY: state.y,
    toZ: state.z,
    feedRate: state.feedRate,
    toolNumber: state.activeTool,
    spindleState: 'cw',
    spindleSpeed: speed,
    lineNumber: ln,
  }
  return { operations: [op], nextState }
})

// M4 — Spindle on (counterclockwise)
mCodeHandlers.set(4, (tokens, state, ln) => {
  const speed = findValue(tokens, 'S') ?? state.spindleSpeed
  const nextState: MachineState = {
    ...state,
    spindleState: 'ccw',
    spindleSpeed: speed,
  }
  const op: Operation = {
    type: 'spindle',
    fromX: state.x,
    fromY: state.y,
    fromZ: state.z,
    toX: state.x,
    toY: state.y,
    toZ: state.z,
    feedRate: state.feedRate,
    toolNumber: state.activeTool,
    spindleState: 'ccw',
    spindleSpeed: speed,
    lineNumber: ln,
  }
  return { operations: [op], nextState }
})

// M5 — Spindle off
mCodeHandlers.set(5, (_tokens, state, ln) => {
  const op: Operation = {
    type: 'spindle',
    fromX: state.x,
    fromY: state.y,
    fromZ: state.z,
    toX: state.x,
    toY: state.y,
    toZ: state.z,
    feedRate: state.feedRate,
    toolNumber: state.activeTool,
    spindleState: 'off',
    spindleSpeed: state.spindleSpeed,
    lineNumber: ln,
  }
  return { operations: [op], nextState: { ...state, spindleState: 'off' } }
})

// M6 — Tool change (uses activeTool already set by T command)
mCodeHandlers.set(6, (_tokens, state, ln) => {
  const op: Operation = {
    type: 'tool-change',
    fromX: state.x,
    fromY: state.y,
    fromZ: state.z,
    toX: state.x,
    toY: state.y,
    toZ: state.z,
    feedRate: state.feedRate,
    toolNumber: state.activeTool,
    spindleState: state.spindleState,
    spindleSpeed: state.spindleSpeed,
    lineNumber: ln,
  }
  return { operations: [op], nextState: state }
})

// M30 — Program end
mCodeHandlers.set(30, (_tokens, state, ln) => {
  const op: Operation = {
    type: 'program-end',
    fromX: state.x,
    fromY: state.y,
    fromZ: state.z,
    toX: state.x,
    toY: state.y,
    toZ: state.z,
    feedRate: state.feedRate,
    toolNumber: state.activeTool,
    spindleState: state.spindleState,
    spindleSpeed: state.spindleSpeed,
    lineNumber: ln,
  }
  return {
    operations: [op],
    nextState: { ...state, spindleState: 'off' },
  }
})

export { gCodeHandlers, mCodeHandlers, findValue }

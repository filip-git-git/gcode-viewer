/**
 * GCode parser — modal state machine that produces typed operation sequences.
 *
 * Entry point: parseGCode(input, dialect?)
 */

import type {
  DialectConfig,
  MachineState,
  ParseResult,
  ParseWarning,
  Operation,
  WorkpieceDimensions,
} from './types'
import { INITIAL_MACHINE_STATE, DEFAULT_DIALECT } from './types'
import { stripComments, tokenizeLine, parseDimensions } from './tokenizer'
import { gCodeHandlers, mCodeHandlers, findValue } from './handlers'

/**
 * Parse a GCode program string into a typed operation sequence.
 *
 * @param input   - Raw GCode text (multi-line string)
 * @param dialect - Optional dialect configuration (defaults to DEFAULT_DIALECT)
 * @returns ParseResult with operations, warnings, dimensions, and final state
 */
export function parseGCode(
  input: string,
  dialect: DialectConfig = DEFAULT_DIALECT,
): ParseResult {
  const lines = input.split(/\r?\n/)
  const operations: Operation[] = []
  const warnings: ParseWarning[] = []
  let dimensions: WorkpieceDimensions | null = null
  let state: MachineState = {
    ...INITIAL_MACHINE_STATE,
    positioningMode: dialect.defaultCoordinateMode,
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1
    const raw = lines[i].trim()

    if (!raw) continue

    // Strip comments and try to extract dimensions
    const { code, comment } = stripComments(raw, dialect.commentStyle)
    if (comment && !dimensions) {
      dimensions = parseDimensions(comment)
    }

    if (!code) continue // comment-only line

    // Tokenize
    const tokens = tokenizeLine(code)
    if (tokens.length === 0) continue

    // Process tokens: find G, M, and T codes, apply handlers
    const result = processTokens(tokens, state, lineNumber, warnings, dialect)
    state = result.nextState
    operations.push(...result.operations)
  }

  return { operations, warnings, dimensions, finalState: state }
}

interface ProcessResult {
  operations: Operation[]
  nextState: MachineState
}

function processTokens(
  tokens: import('./types').ParsedToken[],
  state: MachineState,
  lineNumber: number,
  warnings: ParseWarning[],
  _dialect: DialectConfig,
): ProcessResult {
  const ops: Operation[] = []
  let currentState = state

  // Apply S (spindle speed) if present as standalone parameter
  const sValue = findValue(tokens, 'S')
  if (sValue !== undefined) {
    currentState = { ...currentState, spindleSpeed: sValue }
  }

  // Apply F (feed rate) if present as standalone parameter
  const fValue = findValue(tokens, 'F')
  if (fValue !== undefined) {
    currentState = { ...currentState, feedRate: fValue }
  }

  // Apply T (tool select)
  const tValue = findValue(tokens, 'T')
  if (tValue !== undefined) {
    currentState = { ...currentState, activeTool: tValue }
  }

  // Collect G and M codes from tokens
  const gCodes = tokens
    .filter((t) => t.letter === 'G')
    .map((t) => t.value)
  const mCodes = tokens
    .filter((t) => t.letter === 'M')
    .map((t) => t.value)

  // Process G codes first (modal state changes like G90/G91 before motion)
  // Sort so modal codes (G90, G91, G17, G20, G21) process before motion codes (G0, G1)
  const modalGCodes = gCodes.filter((c) => c >= 17)
  const motionGCodes = gCodes.filter((c) => c < 17)

  for (const code of modalGCodes) {
    const handler = gCodeHandlers.get(code)
    if (handler) {
      const result = handler(tokens, currentState, lineNumber)
      currentState = result.nextState
      ops.push(...result.operations)
    } else {
      warnings.push({
        line: lineNumber,
        message: `Unsupported G-code: G${code}`,
        token: `G${code}`,
      })
    }
  }

  for (const code of motionGCodes) {
    const handler = gCodeHandlers.get(code)
    if (handler) {
      const result = handler(tokens, currentState, lineNumber)
      currentState = result.nextState
      ops.push(...result.operations)
    } else {
      warnings.push({
        line: lineNumber,
        message: `Unsupported G-code: G${code}`,
        token: `G${code}`,
      })
    }
  }

  // If no G code on this line but there are X/Y/Z/F coordinates,
  // apply the current motion mode (modal behavior)
  if (
    gCodes.length === 0 &&
    mCodes.length === 0 &&
    tokens.some((t) => 'XYZF'.includes(t.letter))
  ) {
    const motionCode =
      currentState.motionMode === 'G0'
        ? 0
        : currentState.motionMode === 'G1'
          ? 1
          : currentState.motionMode === 'G2'
            ? 2
            : 3
    const handler = gCodeHandlers.get(motionCode)
    if (handler) {
      const result = handler(tokens, currentState, lineNumber)
      currentState = result.nextState
      ops.push(...result.operations)
    }
  }

  // Process M codes
  for (const code of mCodes) {
    const handler = mCodeHandlers.get(code)
    if (handler) {
      const result = handler(tokens, currentState, lineNumber)
      currentState = result.nextState
      ops.push(...result.operations)
    } else {
      warnings.push({
        line: lineNumber,
        message: `Unsupported M-code: M${code}`,
        token: `M${code}`,
      })
    }
  }

  // Handle spindle default for dialect C (no explicit M3/M5)
  // Already handled by dialect.defaultSpindleState — checked at parse level if needed

  return { operations: ops, nextState: currentState }
}

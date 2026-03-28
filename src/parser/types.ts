/**
 * Parser module types — stable contract between Parser and Simulation Engine.
 */

/** Supported G-code motion modes */
export type MotionMode = 'G0' | 'G1' | 'G2' | 'G3'

/** Coordinate positioning mode */
export type PositioningMode = 'G90' | 'G91'

/** Spindle state */
export type SpindleState = 'off' | 'cw' | 'ccw'

/** Comment style configuration */
export type CommentStyle = 'semicolon' | 'parenthesis' | 'both'

/** Dialect configuration for parser behavior */
export interface DialectConfig {
  defaultCoordinateMode: PositioningMode
  commentStyle: CommentStyle
  defaultSpindleState: SpindleState | 'error'
}

/** Default dialect configuration */
export const DEFAULT_DIALECT: DialectConfig = {
  defaultCoordinateMode: 'G90',
  commentStyle: 'both',
  defaultSpindleState: 'error',
}

/** Token extracted from a single GCode line */
export interface ParsedToken {
  letter: string
  value: number
}

/** Active drilling cycle state (set by G81/G82/G83, cleared by G80) */
export interface DrillingCycleState {
  type: 'G81' | 'G82' | 'G83'
  rPlane: number
  zDepth: number
  feedRate: number
  dwellMs?: number
  peckDepth?: number
}

/** Machine state tracked across parsed lines */
export interface MachineState {
  motionMode: MotionMode
  positioningMode: PositioningMode
  x: number
  y: number
  z: number
  feedRate: number
  spindleState: SpindleState
  spindleSpeed: number
  activeTool: number
  activeDrillingCycle?: DrillingCycleState
}

/** Initial machine state */
export const INITIAL_MACHINE_STATE: MachineState = {
  motionMode: 'G0',
  positioningMode: 'G90',
  x: 0,
  y: 0,
  z: 0,
  feedRate: 0,
  spindleState: 'off',
  spindleSpeed: 0,
  activeTool: 0,
}

/** A single machining operation produced by the parser */
export interface Operation {
  type: 'rapid' | 'linear' | 'arc-cw' | 'arc-ccw' | 'tool-change' | 'spindle' | 'program-end'
  fromX: number
  fromY: number
  fromZ: number
  toX: number
  toY: number
  toZ: number
  feedRate: number
  toolNumber: number
  spindleState: SpindleState
  spindleSpeed: number
  lineNumber: number
  /** Arc center offset from start position (I = X offset, J = Y offset) */
  centerI?: number
  centerJ?: number
  /** Arc radius (R-form specification, alternative to I/J) */
  radius?: number
}

/** A warning produced during parsing */
export interface ParseWarning {
  line: number
  message: string
  token: string
}

/** Workpiece dimensions extracted from comments */
export interface WorkpieceDimensions {
  width: number
  height: number
  thickness: number
}

/** Complete result of parsing a GCode program */
export interface ParseResult {
  operations: Operation[]
  warnings: ParseWarning[]
  dimensions: WorkpieceDimensions | null
  finalState: MachineState
}

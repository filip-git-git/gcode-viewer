/**
 * Simulation module types — contract between Simulation and CSG engines.
 */

import type { Operation, ParseResult, WorkpieceDimensions } from '../parser/types'
import type { ToolDefinition } from '../tools/types'

/** A CSG operation request for the CSG engine */
export interface CsgOperationRequest {
  type: 'mill' | 'drill'
  fromX: number
  fromY: number
  fromZ: number
  toX: number
  toY: number
  toZ: number
  toolNumber: number
  toolDiameter: number
  operationIndex: number
  sourceLineNumber: number
}

/** Warning produced during simulation */
export interface SimulationWarning {
  operationIndex: number
  lineNumber: number
  message: string
}

/** Result of running the simulation engine */
export interface SimulationResult {
  csgRequests: CsgOperationRequest[]
  warnings: SimulationWarning[]
  dimensions: WorkpieceDimensions | null
  toolsUsed: number[]
}

/** Input configuration for the simulation engine */
export interface SimulationInput {
  parseResult: ParseResult
  tools: ToolDefinition[]
  defaultWorkpiece?: WorkpieceDimensions
}

/** Simulation playback state */
export interface SimulationState {
  currentStep: number
  totalSteps: number
  isPlaying: boolean
  operations: Operation[]
  csgRequests: CsgOperationRequest[]
}

/**
 * Tool database types.
 */

/** Supported tool tip geometries */
export type TipType = 'flat-end-mill' | 'ball-end-mill' | 'drill' | 'forstner' | 'bull-nose'

/** A tool definition stored in the tool database */
export interface ToolDefinition {
  toolNumber: number
  name: string
  diameter: number
  tipType: TipType
  cuttingLength: number
  /** Drill/forstner tip angle in degrees (e.g. 118 standard, 135 split-point). Defaults to 118 if absent. */
  tipAngle?: number
  /** Bull-nose corner radius in mm. Must be < diameter/2. */
  cornerRadius?: number
}

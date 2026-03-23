/**
 * Tool database types.
 */

/** Supported tool tip geometries */
export type TipType = 'flat-end-mill' | 'ball-end-mill' | 'drill'

/** A tool definition stored in the tool database */
export interface ToolDefinition {
  toolNumber: number
  name: string
  diameter: number
  tipType: TipType
  cuttingLength: number
}

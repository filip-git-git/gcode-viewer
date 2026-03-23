/**
 * GCode line tokenizer — strips comments, extracts letter-value tokens.
 */

import type { CommentStyle, ParsedToken, WorkpieceDimensions } from './types'

/** Strip comments from a GCode line based on dialect comment style. */
export function stripComments(
  line: string,
  style: CommentStyle,
): { code: string; comment: string } {
  let code = line
  let comment = ''

  if (style === 'parenthesis' || style === 'both') {
    const parenMatch = code.match(/\(([^)]*)\)/)
    if (parenMatch) {
      comment = parenMatch[1]
      code = code.replace(/\([^)]*\)/g, '')
    }
  }

  if (style === 'semicolon' || style === 'both') {
    const semiIdx = code.indexOf(';')
    if (semiIdx !== -1) {
      if (!comment) comment = code.slice(semiIdx + 1).trim()
      code = code.slice(0, semiIdx)
    }
  }

  return { code: code.trim(), comment: comment.trim() }
}

/**
 * Tokenize a GCode line into letter-value pairs.
 * Handles: N-codes (stripped), compound tokens (T1M6), decimal normalization,
 * mixed case, whitespace.
 */
export function tokenizeLine(codePart: string): ParsedToken[] {
  if (!codePart) return []

  const upper = codePart.toUpperCase()
  const tokens: ParsedToken[] = []

  // Match letter followed by optional sign and number (integer or decimal)
  const re = /([A-Z])(-?\d+\.?\d*)/g
  let match: RegExpExecArray | null

  while ((match = re.exec(upper)) !== null) {
    const letter = match[1]
    const value = parseFloat(match[2])

    // Skip N-codes (line numbers) — they don't affect interpretation
    if (letter === 'N') continue

    tokens.push({ letter, value })
  }

  return tokens
}

/** Dimension pattern: digits x digits x digits (e.g. 800x500x18) */
const DIMENSION_RE = /(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)/

/** Try to extract workpiece dimensions from a comment string. */
export function parseDimensions(comment: string): WorkpieceDimensions | null {
  const m = comment.match(DIMENSION_RE)
  if (!m) return null
  return {
    width: parseInt(m[1], 10),
    height: parseInt(m[2], 10),
    thickness: parseInt(m[3], 10),
  }
}

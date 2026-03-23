/**
 * GCode language support for CodeMirror 6.
 *
 * Provides syntax highlighting for GCode programs:
 * - G-codes (motion, modal) in green
 * - M-codes (machine control) in amber
 * - T-codes (tool select) in blue
 * - F/S parameters in purple
 * - Coordinates (X/Y/Z) in default
 * - Numbers following letters
 * - Comments (semicolon and parenthesis styles)
 * - N-codes (line numbers) dimmed
 */

import { StreamLanguage, type StreamParser } from '@codemirror/language'
import { tags } from '@lezer/highlight'

interface GCodeState {
  inParenComment: boolean
}

const gcodeStreamParser: StreamParser<GCodeState> = {
  startState(): GCodeState {
    return { inParenComment: false }
  },

  token(stream, state): string | null {
    // Continue paren comment
    if (state.inParenComment) {
      if (stream.skipTo(')')) {
        stream.next()
        state.inParenComment = false
      } else {
        stream.skipToEnd()
      }
      return 'comment'
    }

    // Skip whitespace
    if (stream.eatSpace()) return null

    // Semicolon comment — rest of line
    if (stream.match(';')) {
      stream.skipToEnd()
      return 'comment'
    }

    // Paren comment start
    if (stream.match('(')) {
      if (stream.skipTo(')')) {
        stream.next()
      } else {
        state.inParenComment = true
        stream.skipToEnd()
      }
      return 'comment'
    }

    // Percent sign (program boundary)
    if (stream.match('%')) {
      stream.skipToEnd()
      return 'meta'
    }

    // G-codes
    if (stream.match(/^[Gg]\d+(\.\d+)?/)) {
      return 'keyword'
    }

    // M-codes
    if (stream.match(/^[Mm]\d+/)) {
      return 'atom'
    }

    // T-codes (tool select)
    if (stream.match(/^[Tt]\d+/)) {
      return 'typeName'
    }

    // N-codes (line numbers)
    if (stream.match(/^[Nn]\d+/)) {
      return 'lineComment'
    }

    // Feed rate and spindle speed
    if (stream.match(/^[FfSs]-?\d+(\.\d+)?/)) {
      return 'number'
    }

    // Coordinates X, Y, Z, I, J, K, R
    if (stream.match(/^[XxYyZzIiJjKkRr]-?\d+(\.\d+)?/)) {
      return 'variableName'
    }

    // Standalone numbers
    if (stream.match(/^-?\d+(\.\d+)?/)) {
      return 'number'
    }

    // Skip any other character
    stream.next()
    return null
  },

  languageData: {
    commentTokens: { line: ';', block: { open: '(', close: ')' } },
  },
}

/** CodeMirror 6 language extension for GCode syntax highlighting */
export const gcodeLanguage = StreamLanguage.define(gcodeStreamParser)

/** Tag mappings for the GCode highlighter */
export const gcodeHighlightTags = {
  keyword: tags.keyword,       // G-codes
  atom: tags.atom,             // M-codes
  typeName: tags.typeName,     // T-codes
  number: tags.number,         // F/S values
  variableName: tags.variableName, // X/Y/Z coords
  comment: tags.comment,       // Comments
  lineComment: tags.lineComment, // N-codes
  meta: tags.meta,             // % boundaries
}

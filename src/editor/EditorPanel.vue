<script setup lang="ts">
/**
 * EditorPanel — CodeMirror 6 GCode editor with syntax highlighting.
 */

import { ref, shallowRef, watch, onMounted, onUnmounted } from 'vue'
import { EditorView, Decoration, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { gcodeLanguage } from './gcodeLanguage'

const props = defineProps<{
  modelValue: string
  highlightLine?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'cursor-change': [line: number, col: number]
  'file-drop': [name: string, content: string]
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)
const isUpdatingFromProp = ref(false)
const isDragOver = ref(false)

// ── Simulation line highlight ────────────────────────────────────
const setHighlightLine = StateEffect.define<number | null>()

const simLineDecoration = Decoration.line({ class: 'cm-simHighlightLine' })

const highlightLineField = StateField.define({
  create() { return Decoration.none },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightLine)) {
        if (effect.value === null) return Decoration.none
        const lineNum = effect.value
        if (lineNum < 1 || lineNum > tr.state.doc.lines) return Decoration.none
        const line = tr.state.doc.line(lineNum)
        return Decoration.set([simLineDecoration.range(line.from)])
      }
    }
    return decorations
  },
  provide: (f) => EditorView.decorations.from(f),
})

const gcodeTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-editor-bg, #0d1117)',
    color: 'var(--color-text, #e6edf3)',
    height: '100%',
    fontSize: '13px',
    fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  },
  '.cm-content': {
    caretColor: 'var(--color-amber, #e8a838)',
    padding: '8px 0',
    lineHeight: '1.6',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--color-amber, #e8a838)',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(88, 166, 255, 0.15) !important',
  },
  '.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(88, 166, 255, 0.2) !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(232, 168, 56, 0.04)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(232, 168, 56, 0.06)',
    color: 'var(--color-amber, #e8a838)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-surface, #161b22)',
    color: 'var(--color-text-muted, #8b949e)',
    border: 'none',
    borderRight: '1px solid var(--color-border, #30363d)',
    minWidth: '42px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
    minWidth: '32px',
    fontSize: '11px',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1px solid var(--color-border, #30363d)',
    color: 'var(--color-text, #e6edf3)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(232, 168, 56, 0.2)',
    outline: '1px solid rgba(232, 168, 56, 0.4)',
  },
  '.cm-simHighlightLine': {
    backgroundColor: 'rgba(126, 231, 135, 0.12) !important',
    borderLeft: '3px solid #7ee787',
  },
}, { dark: true })

const gcodeHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: '#7ee787' },
    { tag: tags.atom, color: '#e8a838' },
    { tag: tags.typeName, color: '#58a6ff' },
    { tag: tags.number, color: '#d2a8ff' },
    { tag: tags.variableName, color: '#c9d1d9' },
    { tag: tags.comment, color: '#5a6370', fontStyle: 'italic' },
    { tag: tags.lineComment, color: '#484f58' },
    { tag: tags.meta, color: '#e8a838' },
  ]),
)

const cursorListener = EditorView.updateListener.of((update) => {
  if (update.selectionSet) {
    const pos = update.state.selection.main.head
    const line = update.state.doc.lineAt(pos)
    emit('cursor-change', line.number, pos - line.from + 1)
  }
  if (update.docChanged && !isUpdatingFromProp.value) {
    emit('update:modelValue', update.state.doc.toString())
  }
})

function createExtensions(): Extension[] {
  return [
    gcodeLanguage,
    gcodeTheme,
    gcodeHighlighting,
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    bracketMatching(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    cursorListener,
    highlightLineField,
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
  ]
}

function initEditor(): void {
  if (!editorContainer.value) return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: createExtensions(),
  })

  editorView.value = new EditorView({
    state,
    parent: editorContainer.value,
  })
}

watch(
  () => props.modelValue,
  (newValue) => {
    if (!editorView.value) return
    const currentDoc = editorView.value.state.doc.toString()
    if (currentDoc === newValue) return

    isUpdatingFromProp.value = true
    editorView.value.dispatch({
      changes: {
        from: 0,
        to: editorView.value.state.doc.length,
        insert: newValue,
      },
    })
    isUpdatingFromProp.value = false
  },
)

watch(
  () => props.highlightLine,
  (lineNum) => {
    if (!editorView.value) return
    editorView.value.dispatch({
      effects: setHighlightLine.of(lineNum ?? null),
    })
    // Scroll highlighted line into view
    if (lineNum && lineNum >= 1 && lineNum <= editorView.value.state.doc.lines) {
      const line = editorView.value.state.doc.line(lineNum)
      editorView.value.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      })
    }
  },
)

function readFile(file: File): void {
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      emit('file-drop', file.name, reader.result)
    }
  }
  reader.readAsText(file)
}

// Window-level drag prevention
function preventBrowserFileDrag(e: DragEvent): void {
  e.preventDefault()
}

function onPanelDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  isDragOver.value = true
}

function onPanelDrop(e: DragEvent): void {
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) readFile(file)
}

function onPanelDragLeave(e: DragEvent): void {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (
    e.clientX <= rect.left ||
    e.clientX >= rect.right ||
    e.clientY <= rect.top ||
    e.clientY >= rect.bottom
  ) {
    isDragOver.value = false
  }
}

function focusEditor(): void {
  editorView.value?.focus()
}

onMounted(() => {
  initEditor()
  window.addEventListener('dragover', preventBrowserFileDrag)
  window.addEventListener('drop', preventBrowserFileDrag)
})

onUnmounted(() => {
  editorView.value?.destroy()
  window.removeEventListener('dragover', preventBrowserFileDrag)
  window.removeEventListener('drop', preventBrowserFileDrag)
})
</script>

<template>
  <div
    class="editor-panel"
    @dragover.prevent="onPanelDragOver"
    @drop.prevent="onPanelDrop"
    @dragleave="onPanelDragLeave"
  >
    <div ref="editorContainer" class="editor-panel__cm" />

    <!-- Placeholder shown when empty — click passes through to CM -->
    <div
      v-if="!modelValue"
      class="editor-panel__empty-hint"
      @click="focusEditor"
    >
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="12" y2="12" />
        <line x1="15" y1="15" x2="12" y2="12" />
      </svg>
      <span>Drop .nc / .gcode file, or click to type</span>
    </div>

    <!-- Drag visual feedback -->
    <div v-if="isDragOver" class="editor-panel__drag-overlay">
      <span>Drop file to load</span>
    </div>
  </div>
</template>

<style scoped>
.editor-panel {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--color-editor-bg, #0d1117);
}

.editor-panel__cm {
  width: 100%;
  height: 100%;
}

.editor-panel__empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  pointer-events: none;
  z-index: 1;
  color: var(--color-text-muted, #8b949e);
  font-family: var(--font-ui, sans-serif);
  font-size: 13px;
  opacity: 0.6;
}

.editor-panel__empty-hint svg {
  color: var(--color-amber, #e8a838);
  opacity: 0.4;
}

.editor-panel__drag-overlay {
  position: absolute;
  inset: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(232, 168, 56, 0.06);
  border: 2px dashed var(--color-amber, #e8a838);
  border-radius: 4px;
  z-index: 20;
  pointer-events: none;
  font-family: var(--font-ui, sans-serif);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-amber, #e8a838);
}
</style>

<!-- Non-scoped: CodeMirror creates DOM dynamically outside Vue's scope -->
<style>
.editor-panel__cm .cm-editor {
  height: 100%;
}
.editor-panel__cm .cm-scroller {
  overflow: auto;
}
</style>

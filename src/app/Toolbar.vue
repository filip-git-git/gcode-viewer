<script setup lang="ts">
/**
 * Toolbar — top application bar with CNC-panel aesthetic.
 *
 * Contains: app title, file actions, tool database toggle,
 * workpiece dimensions button, view mode selector.
 */

import { ref } from 'vue'

defineProps<{
  fileName: string
  isProcessing: boolean
  hasWorkpiece: boolean
  operationCount: number
  csgTimeMs: number
}>()

const emit = defineEmits<{
  toggleTools: []
  openDimensions: []
  loadFile: [name: string, content: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function triggerFileOpen(): void {
  fileInput.value?.click()
}

function onFileSelected(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      emit('loadFile', file.name, reader.result)
    }
  }
  reader.readAsText(file)
  // Reset so same file can be re-selected
  input.value = ''
}

function formatTime(ms: number): string {
  if (ms < 1) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <header class="toolbar">
    <div class="toolbar__left">
      <div class="toolbar__brand">
        <svg class="toolbar__logo" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span class="toolbar__title">gcode-viewer</span>
      </div>

      <div class="toolbar__separator" />

      <div class="toolbar__actions">
        <input
          ref="fileInput"
          type="file"
          accept=".nc,.gcode,.txt,.ngc,.tap,.cnc"
          class="toolbar__file-input"
          @change="onFileSelected"
        />

        <button
          class="toolbar__btn"
          title="Open GCode file (Ctrl+O)"
          @click="triggerFileOpen"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0012.5 5H8.25L6.72 3.22A.75.75 0 006.19 3H3.5z" />
          </svg>
          <span>Open</span>
        </button>

        <button
          class="toolbar__btn"
          title="Tool database"
          @click="$emit('toggleTools')"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M5.433 2.304A4.494 4.494 0 0 1 8 3.5c1.135 0 2.177-.42 2.967-1.112a.75.75 0 0 1 1.059.054l.198.213a2 2 0 0 1-.052 2.785l-.36.34A4.5 4.5 0 0 1 8.5 9.5a4.5 4.5 0 0 1-3.312-3.72l-.36-.34a2 2 0 0 1-.052-2.785l.198-.213a.75.75 0 0 1 1.059-.054z" />
            <path d="M6.5 10.5v3a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-3" />
          </svg>
          <span>Tools</span>
        </button>

        <button
          class="toolbar__btn"
          title="Workpiece dimensions"
          @click="$emit('openDimensions')"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM3 5v6h10V5H3z" />
          </svg>
          <span>Dimensions</span>
        </button>
      </div>
    </div>

    <div class="toolbar__right">
      <div class="toolbar__readout" v-if="hasWorkpiece">
        <div class="toolbar__readout-item">
          <span class="toolbar__readout-label">OPS</span>
          <span class="toolbar__readout-value">{{ operationCount }}</span>
        </div>
        <div class="toolbar__readout-item">
          <span class="toolbar__readout-label">CSG</span>
          <span class="toolbar__readout-value">{{ formatTime(csgTimeMs) }}</span>
        </div>
      </div>

      <div
        class="toolbar__status-led"
        :class="{
          'toolbar__status-led--idle': !isProcessing && !hasWorkpiece,
          'toolbar__status-led--processing': isProcessing,
          'toolbar__status-led--ready': !isProcessing && hasWorkpiece,
        }"
        :title="isProcessing ? 'Processing...' : hasWorkpiece ? 'Ready' : 'Idle'"
      />
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: 12px;
}

.toolbar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.toolbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.toolbar__logo {
  color: var(--color-amber);
}

.toolbar__title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.5px;
  text-transform: lowercase;
}

.toolbar__separator {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  flex-shrink: 0;
}

.toolbar__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}

.toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar__btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--color-text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}

.toolbar__btn:hover {
  background: var(--color-hover);
  border-color: var(--color-border);
  color: var(--color-text);
}

.toolbar__btn:active {
  background: var(--color-active);
}

.toolbar__btn svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.toolbar__btn:hover svg {
  opacity: 1;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.toolbar__readout {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 2px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
}

.toolbar__readout-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.toolbar__readout-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.toolbar__readout-value {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-amber);
  letter-spacing: 0.5px;
  min-width: 28px;
  text-align: right;
}

/* Status LED */
.toolbar__status-led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.3s, box-shadow 0.3s;
}

.toolbar__status-led--idle {
  background: var(--color-text-muted);
  box-shadow: 0 0 3px rgba(139, 148, 158, 0.3);
}

.toolbar__status-led--processing {
  background: var(--color-amber);
  box-shadow: 0 0 6px rgba(232, 168, 56, 0.6);
  animation: pulse-led 0.8s ease-in-out infinite;
}

.toolbar__status-led--ready {
  background: var(--color-green);
  box-shadow: 0 0 6px rgba(63, 185, 80, 0.4);
}

@keyframes pulse-led {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

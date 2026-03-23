<script setup lang="ts">
/**
 * StatusBar — bottom bar styled as CNC machine status panel.
 *
 * Shows: parser warnings, file name, line count, cursor position,
 * dimensions readout, processing indicator.
 */

import type { ParseWarning } from '../parser/types'
import type { WorkpieceDimensions } from '../parser/types'

defineProps<{
  warnings: ParseWarning[]
  fileName: string
  lineCount: number
  cursorLine: number
  cursorCol: number
  dimensions: WorkpieceDimensions | null
  isProcessing: boolean
}>()
</script>

<template>
  <footer class="status-bar">
    <div class="status-bar__left">
      <!-- Warnings -->
      <div
        class="status-bar__segment status-bar__warnings"
        :class="{ 'status-bar__warnings--active': warnings.length > 0 }"
        :title="warnings.length > 0 ? warnings.map(w => `Line ${w.line}: ${w.message}`).join('\n') : 'No warnings'"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <path v-if="warnings.length > 0" d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
          <path v-else d="M8 15A7 7 0 108 1a7 7 0 000 14zm0-1.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm-.75-8.25a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 5.75a.75.75 0 100 1.5.75.75 0 000-1.5z" />
        </svg>
        <span>{{ warnings.length }}</span>
      </div>

      <!-- File name -->
      <div class="status-bar__segment" v-if="fileName">
        <span class="status-bar__file-name">{{ fileName }}</span>
      </div>
      <div class="status-bar__segment" v-else>
        <span class="status-bar__file-empty">No file</span>
      </div>
    </div>

    <div class="status-bar__center">
      <!-- Dimensions readout -->
      <div class="status-bar__segment status-bar__dims" v-if="dimensions">
        <span class="status-bar__dims-label">WPC</span>
        <span class="status-bar__dims-value">
          {{ dimensions.width }}<span class="status-bar__dims-unit">w</span>
          &times;
          {{ dimensions.height }}<span class="status-bar__dims-unit">h</span>
          &times;
          {{ dimensions.thickness }}<span class="status-bar__dims-unit">t</span>
          mm
        </span>
      </div>
    </div>

    <div class="status-bar__right">
      <!-- Processing -->
      <div class="status-bar__segment status-bar__processing" v-if="isProcessing">
        <div class="status-bar__spinner" />
        <span>Processing</span>
      </div>

      <!-- Line count -->
      <div class="status-bar__segment" v-if="lineCount > 0">
        <span class="status-bar__metric">{{ lineCount }} lines</span>
      </div>

      <!-- Cursor -->
      <div class="status-bar__segment status-bar__cursor">
        <span>Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
      </div>

      <!-- Language -->
      <div class="status-bar__segment">
        <span>GCode</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 8px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
  gap: 4px;
  overflow: hidden;
}

.status-bar__left,
.status-bar__center,
.status-bar__right {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.status-bar__left {
  flex: 1;
}

.status-bar__center {
  flex-shrink: 0;
}

.status-bar__right {
  flex: 1;
  justify-content: flex-end;
}

.status-bar__segment {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  height: 24px;
  white-space: nowrap;
  transition: background 0.1s;
}

.status-bar__segment:hover {
  background: var(--color-hover);
}

/* Warnings */
.status-bar__warnings svg {
  color: var(--color-text-muted);
}

.status-bar__warnings--active svg {
  color: var(--color-warning);
}

.status-bar__warnings--active span {
  color: var(--color-warning);
}

/* File name */
.status-bar__file-name {
  color: var(--color-text-secondary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-bar__file-empty {
  color: var(--color-text-muted);
  font-style: italic;
}

/* Dimensions */
.status-bar__dims-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--color-text-muted);
  margin-right: 2px;
}

.status-bar__dims-value {
  color: var(--color-blue);
  font-variant-numeric: tabular-nums;
}

.status-bar__dims-unit {
  font-size: 9px;
  color: var(--color-text-muted);
  margin-left: 1px;
}

/* Cursor */
.status-bar__cursor {
  font-variant-numeric: tabular-nums;
}

/* Metrics */
.status-bar__metric {
  font-variant-numeric: tabular-nums;
}

/* Processing spinner */
.status-bar__processing {
  color: var(--color-amber);
}

.status-bar__spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--color-amber);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

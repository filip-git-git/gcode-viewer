<script setup lang="ts">
/**
 * VerificationReport — UC-005 program verification panel.
 *
 * Displays parse/simulation warnings, workpiece dimensions,
 * operation summary, and overall traffic-light status.
 */

import { computed } from 'vue'
import type { ParseWarning, WorkpieceDimensions } from '../parser/types'
import type { SimulationWarning } from '../simulation/types'

const props = defineProps<{
  open: boolean
  parseWarnings: ParseWarning[]
  simWarnings: SimulationWarning[]
  dimensions: WorkpieceDimensions | null
  operationCount: number
  toolsUsed: number[]
  hasFile: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

type StatusLevel = 'green' | 'amber' | 'red'

const status = computed<StatusLevel>(() => {
  if (!props.hasFile) return 'red'
  if (!props.dimensions) return 'red'
  if (props.parseWarnings.length > 0 || props.simWarnings.length > 0) return 'amber'
  return 'green'
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'green': return 'Ready'
    case 'amber': return 'Warnings'
    case 'red': return 'Issues'
  }
})

const totalWarnings = computed(() =>
  props.parseWarnings.length + props.simWarnings.length,
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="vr-overlay" @click.self="$emit('close')">
      <div class="vr-panel">
        <header class="vr-header">
          <h2 class="vr-title">Program Verification</h2>
          <button class="vr-close" @click="$emit('close')" title="Close">&times;</button>
        </header>

        <!-- No file loaded -->
        <div v-if="!hasFile" class="vr-empty">
          <p>No program loaded</p>
          <p class="vr-empty-hint">Open a GCode file to verify</p>
        </div>

        <div v-else class="vr-body">
          <!-- Traffic light status -->
          <div class="vr-status" :class="`vr-status--${status}`">
            <div class="vr-status-led" />
            <span class="vr-status-label">{{ statusLabel }}</span>
            <span class="vr-status-detail" v-if="totalWarnings > 0">
              {{ totalWarnings }} warning{{ totalWarnings !== 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Dimensions -->
          <section class="vr-section">
            <h3 class="vr-section-title">Workpiece Dimensions</h3>
            <div v-if="dimensions" class="vr-dims">
              <span>{{ dimensions.width }} × {{ dimensions.height }} × {{ dimensions.thickness }} mm</span>
            </div>
            <div v-else class="vr-dims vr-dims--missing">
              Not detected — set manually via Dimensions button
            </div>
          </section>

          <!-- Operations summary -->
          <section class="vr-section">
            <h3 class="vr-section-title">Operations</h3>
            <div class="vr-stats">
              <div class="vr-stat">
                <span class="vr-stat-value">{{ operationCount }}</span>
                <span class="vr-stat-label">total operations</span>
              </div>
              <div class="vr-stat">
                <span class="vr-stat-value">{{ toolsUsed.length }}</span>
                <span class="vr-stat-label">tool{{ toolsUsed.length !== 1 ? 's' : '' }} used</span>
              </div>
            </div>
            <div v-if="toolsUsed.length > 0" class="vr-tools-list">
              Tools: {{ toolsUsed.map(t => `T${t}`).join(', ') }}
            </div>
          </section>

          <!-- Parse warnings -->
          <section class="vr-section" v-if="parseWarnings.length > 0">
            <h3 class="vr-section-title">
              Parse Warnings
              <span class="vr-badge">{{ parseWarnings.length }}</span>
            </h3>
            <ul class="vr-warning-list">
              <li v-for="(w, i) in parseWarnings" :key="i" class="vr-warning">
                <span class="vr-warning-line">L{{ w.line }}</span>
                <span class="vr-warning-msg">{{ w.message }}</span>
              </li>
            </ul>
          </section>

          <!-- Simulation warnings -->
          <section class="vr-section" v-if="simWarnings.length > 0">
            <h3 class="vr-section-title">
              Simulation Warnings
              <span class="vr-badge">{{ simWarnings.length }}</span>
            </h3>
            <ul class="vr-warning-list">
              <li v-for="(w, i) in simWarnings" :key="i" class="vr-warning">
                <span class="vr-warning-line">L{{ w.lineNumber }}</span>
                <span class="vr-warning-msg">{{ w.message }}</span>
              </li>
            </ul>
          </section>

          <!-- All clear -->
          <section class="vr-section" v-if="totalWarnings === 0">
            <p class="vr-all-clear">No warnings — program looks good</p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.vr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vr-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.vr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.vr-title {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.vr-close {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.vr-close:hover {
  color: var(--color-text);
}

.vr-empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-family: var(--font-ui);
  font-size: 13px;
}

.vr-empty-hint {
  color: var(--color-text-muted);
  font-size: 12px;
  margin-top: 4px;
}

.vr-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Status indicator */
.vr-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid;
}

.vr-status--green {
  background: rgba(63, 185, 80, 0.08);
  border-color: rgba(63, 185, 80, 0.3);
}

.vr-status--amber {
  background: rgba(232, 168, 56, 0.08);
  border-color: rgba(232, 168, 56, 0.3);
}

.vr-status--red {
  background: rgba(248, 81, 73, 0.08);
  border-color: rgba(248, 81, 73, 0.3);
}

.vr-status-led {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.vr-status--green .vr-status-led { background: var(--color-green); }
.vr-status--amber .vr-status-led { background: var(--color-amber); }
.vr-status--red .vr-status-led { background: #f85149; }

.vr-status-label {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.vr-status-detail {
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: auto;
}

/* Sections */
.vr-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vr-section-title {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.vr-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-amber);
  color: #000;
  font-size: 10px;
  font-weight: 700;
}

.vr-dims {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-text);
  padding: 6px 10px;
  background: var(--color-bg);
  border-radius: 4px;
}

.vr-dims--missing {
  color: var(--color-amber);
  font-family: var(--font-ui);
  font-style: italic;
}

.vr-stats {
  display: flex;
  gap: 20px;
}

.vr-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.vr-stat-value {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.vr-stat-label {
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.vr-tools-list {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Warning list */
.vr-warning-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.vr-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 8px;
  background: var(--color-bg);
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 12px;
}

.vr-warning-line {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-amber);
  flex-shrink: 0;
  min-width: 32px;
}

.vr-warning-msg {
  color: var(--color-text-secondary);
}

.vr-all-clear {
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--color-green);
  margin: 0;
}
</style>

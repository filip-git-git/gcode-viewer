<script setup lang="ts">
/**
 * DimensionDialog — modal for manual workpiece dimension entry.
 *
 * Appears when GCode doesn't contain dimension comments (BR-003 fallback).
 * Inputs: width, height, thickness in mm. Validates positive numbers.
 * Remembers last-used values in localStorage.
 */

import { ref, onMounted, watch } from 'vue'
import type { WorkpieceDimensions } from '../parser/types'

const STORAGE_KEY = 'gcode-viewer-dimensions'

const props = defineProps<{
  open: boolean
  currentDimensions: WorkpieceDimensions | null
}>()

const emit = defineEmits<{
  close: []
  apply: [dims: WorkpieceDimensions]
}>()

const width = ref(600)
const height = ref(400)
const thickness = ref(18)
const error = ref('')

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const dims = JSON.parse(saved)
      if (dims.width > 0) width.value = dims.width
      if (dims.height > 0) height.value = dims.height
      if (dims.thickness > 0) thickness.value = dims.thickness
    } catch { /* ignore */ }
  }
})

watch(
  () => props.currentDimensions,
  (dims) => {
    if (dims) {
      width.value = dims.width
      height.value = dims.height
      thickness.value = dims.thickness
    }
  },
  { immediate: true },
)

function validate(): boolean {
  if (width.value <= 0 || height.value <= 0 || thickness.value <= 0) {
    error.value = 'All dimensions must be positive numbers'
    return false
  }
  if (width.value > 5000 || height.value > 5000) {
    error.value = 'Maximum panel size: 5000mm'
    return false
  }
  if (thickness.value > 200) {
    error.value = 'Maximum thickness: 200mm'
    return false
  }
  error.value = ''
  return true
}

function apply(): void {
  if (!validate()) return
  const dims: WorkpieceDimensions = {
    width: width.value,
    height: height.value,
    thickness: thickness.value,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dims))
  emit('apply', dims)
  emit('close')
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'Enter') apply()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-overlay"
      @click.self="$emit('close')"
      @keydown="onKeyDown"
    >
      <div
        class="dialog"
        role="dialog"
        aria-label="Workpiece dimensions"
        aria-modal="true"
      >
        <div class="dialog__header">
          <h2 class="dialog__title">Workpiece Dimensions</h2>
          <button class="dialog__close" @click="$emit('close')" aria-label="Close">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>

        <div class="dialog__body">
          <p class="dialog__hint">
            Enter panel dimensions in millimeters. These are used when dimensions aren't specified in the GCode file.
          </p>

          <div class="dialog__fields">
            <label class="dialog__field">
              <span class="dialog__label">Width (X)</span>
              <div class="dialog__input-wrap">
                <input
                  v-model.number="width"
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  class="dialog__input"
                />
                <span class="dialog__unit">mm</span>
              </div>
            </label>

            <label class="dialog__field">
              <span class="dialog__label">Height (Y)</span>
              <div class="dialog__input-wrap">
                <input
                  v-model.number="height"
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  class="dialog__input"
                />
                <span class="dialog__unit">mm</span>
              </div>
            </label>

            <label class="dialog__field">
              <span class="dialog__label">Thickness (Z)</span>
              <div class="dialog__input-wrap">
                <input
                  v-model.number="thickness"
                  type="number"
                  min="1"
                  max="200"
                  step="0.5"
                  class="dialog__input"
                />
                <span class="dialog__unit">mm</span>
              </div>
            </label>
          </div>

          <div class="dialog__preview">
            <span class="dialog__preview-label">Preview</span>
            <span class="dialog__preview-value">
              {{ width }} &times; {{ height }} &times; {{ thickness }} mm
            </span>
          </div>

          <p class="dialog__error" v-if="error">{{ error }}</p>
        </div>

        <div class="dialog__footer">
          <button class="dialog__btn dialog__btn--secondary" @click="$emit('close')">
            Cancel
          </button>
          <button class="dialog__btn dialog__btn--primary" @click="apply">
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: overlay-in 0.15s ease;
}

@keyframes overlay-in {
  from { opacity: 0; }
}

.dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  animation: dialog-in 0.15s ease;
}

@keyframes dialog-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
}

.dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.dialog__title {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.dialog__close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  display: flex;
}

.dialog__close:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.dialog__body {
  padding: 16px;
}

.dialog__hint {
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0 0 16px;
  line-height: 1.5;
}

.dialog__fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dialog__label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  letter-spacing: 0.3px;
}

.dialog__input-wrap {
  display: flex;
  align-items: center;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.dialog__input-wrap:focus-within {
  border-color: var(--color-amber);
  box-shadow: 0 0 0 1px rgba(232, 168, 56, 0.2);
}

.dialog__input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 7px 10px;
  outline: none;
  min-width: 0;
}

.dialog__input::-webkit-inner-spin-button,
.dialog__input::-webkit-outer-spin-button {
  opacity: 0.3;
}

.dialog__unit {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
  padding: 0 10px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  height: 100%;
  display: flex;
  align-items: center;
  background: var(--color-surface);
}

.dialog__preview {
  margin-top: 16px;
  padding: 8px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dialog__preview-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.dialog__preview-value {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-amber);
  font-variant-numeric: tabular-nums;
}

.dialog__error {
  margin: 12px 0 0;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--color-error);
}

.dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}

.dialog__btn {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.12s;
}

.dialog__btn--secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.dialog__btn--secondary:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.dialog__btn--primary {
  background: var(--color-amber);
  border: 1px solid var(--color-amber);
  color: #0d1117;
  font-weight: 600;
}

.dialog__btn--primary:hover {
  background: #d49830;
  border-color: #d49830;
}
</style>

<script setup lang="ts">
/**
 * SplitPane — resizable horizontal split layout.
 *
 * Draggable amber-glow divider between left and right panels.
 * Minimum panel width: 280px. Persists split ratio.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    initialRatio?: number
    minLeftPx?: number
    minRightPx?: number
  }>(),
  {
    initialRatio: 0.42,
    minLeftPx: 280,
    minRightPx: 280,
  },
)

const containerRef = ref<HTMLElement | null>(null)
const ratio = ref(props.initialRatio)
const isDragging = ref(false)

const leftStyle = computed(() => ({
  width: `${ratio.value * 100}%`,
}))

const rightStyle = computed(() => ({
  width: `${(1 - ratio.value) * 100}%`,
}))

function onPointerDown(e: PointerEvent): void {
  isDragging.value = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent): void {
  if (!isDragging.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const totalWidth = rect.width

  let newRatio = x / totalWidth
  // Enforce minimums
  const minLeftRatio = props.minLeftPx / totalWidth
  const minRightRatio = props.minRightPx / totalWidth
  newRatio = Math.max(minLeftRatio, Math.min(1 - minRightRatio, newRatio))

  ratio.value = newRatio
}

function onPointerUp(): void {
  isDragging.value = false
}

// Keyboard support for divider
function onKeyDown(e: KeyboardEvent): void {
  const step = e.shiftKey ? 0.05 : 0.01
  if (e.key === 'ArrowLeft') {
    ratio.value = Math.max(0.15, ratio.value - step)
    e.preventDefault()
  } else if (e.key === 'ArrowRight') {
    ratio.value = Math.min(0.85, ratio.value + step)
    e.preventDefault()
  }
}

onMounted(() => {
  const saved = localStorage.getItem('gcode-viewer-split-ratio')
  if (saved) {
    const parsed = parseFloat(saved)
    if (!isNaN(parsed) && parsed > 0.1 && parsed < 0.9) {
      ratio.value = parsed
    }
  }
})

onUnmounted(() => {
  localStorage.setItem('gcode-viewer-split-ratio', ratio.value.toString())
})
</script>

<template>
  <div
    ref="containerRef"
    class="split-pane"
    :class="{ 'split-pane--dragging': isDragging }"
  >
    <div class="split-pane__left" :style="leftStyle">
      <slot name="left" />
    </div>

    <div
      class="split-pane__divider"
      role="separator"
      :aria-valuenow="Math.round(ratio * 100)"
      aria-valuemin="15"
      aria-valuemax="85"
      aria-label="Resize panels"
      tabindex="0"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @keydown="onKeyDown"
    >
      <div class="split-pane__divider-line" />
      <div class="split-pane__divider-grip">
        <span /><span /><span />
      </div>
    </div>

    <div class="split-pane__right" :style="rightStyle">
      <slot name="right" />
    </div>
  </div>
</template>

<style scoped>
.split-pane {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.split-pane--dragging {
  cursor: col-resize;
  user-select: none;
}

.split-pane__left,
.split-pane__right {
  overflow: hidden;
  height: 100%;
}

.split-pane__divider {
  flex-shrink: 0;
  width: 6px;
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.15s;
}

.split-pane__divider:hover,
.split-pane__divider:focus-visible {
  background: rgba(232, 168, 56, 0.08);
}

.split-pane__divider:focus-visible {
  outline: 1px solid var(--color-amber);
  outline-offset: -1px;
}

.split-pane__divider-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--color-border);
  transition: background 0.2s, box-shadow 0.2s;
}

.split-pane__divider:hover .split-pane__divider-line,
.split-pane--dragging .split-pane__divider-line {
  background: var(--color-amber);
  box-shadow: 0 0 8px rgba(232, 168, 56, 0.4), 0 0 2px rgba(232, 168, 56, 0.8);
}

.split-pane__divider-grip {
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 1;
}

.split-pane__divider-grip span {
  display: block;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--color-text-muted);
  transition: background 0.2s;
}

.split-pane__divider:hover .split-pane__divider-grip span {
  background: var(--color-amber);
}
</style>

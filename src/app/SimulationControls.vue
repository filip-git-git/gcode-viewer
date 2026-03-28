<script setup lang="ts">
/**
 * SimulationControls — play/pause/step controls for step-by-step simulation.
 *
 * Displays:
 *   [|<] [<] [>||] [>] [>|]  Step 5/58  [=========>----] slider
 */

import { computed } from 'vue'

const props = defineProps<{
  currentStep: number
  totalSteps: number
  isPlaying: boolean
  isStepMode: boolean
  isComputing: boolean
  hasWorkpiece: boolean
}>()

const emit = defineEmits<{
  stepForward: []
  stepBack: []
  play: []
  pause: []
  reset: []
  enterStepMode: []
  exitStepMode: []
  goToStep: [step: number]
}>()

const canStepBack = computed(() => props.isStepMode && props.currentStep > 0 && !props.isComputing)
const canStepForward = computed(() => props.isStepMode && props.currentStep < props.totalSteps && !props.isComputing)
const canPlay = computed(() => props.isStepMode && props.currentStep < props.totalSteps && !props.isComputing)

function onSliderInput(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('goToStep', parseInt(target.value, 10))
}
</script>

<template>
  <div v-if="hasWorkpiece && totalSteps > 0" class="sim-controls">
    <!-- Step mode toggle -->
    <button
      v-if="!isStepMode"
      class="sim-btn sim-btn--mode"
      title="Enter step-by-step mode"
      @click="emit('enterStepMode')"
    >
      Simulation
</button>
    <button
      v-else
      class="sim-btn sim-btn--mode sim-btn--active"
      title="Exit step mode (show final result)"
      @click="emit('exitStepMode')"
    >
      Final
    </button>

    <template v-if="isStepMode">
      <div class="sim-controls__divider" />

      <!-- Reset to start -->
      <button
        class="sim-btn"
        :disabled="currentStep === 0 || isComputing"
        title="Reset to start"
        @click="emit('reset')"
      >
        &#x23EE;
      </button>

      <!-- Step back -->
      <button
        class="sim-btn"
        :disabled="!canStepBack"
        title="Step back"
        @click="emit('stepBack')"
      >
        &#x23EA;
      </button>

      <!-- Play/Pause -->
      <button
        v-if="!isPlaying"
        class="sim-btn sim-btn--play"
        :disabled="!canPlay"
        title="Play"
        @click="emit('play')"
      >
        &#x25B6;
      </button>
      <button
        v-else
        class="sim-btn sim-btn--play"
        title="Pause"
        @click="emit('pause')"
      >
        &#x23F8;
      </button>

      <!-- Step forward -->
      <button
        class="sim-btn"
        :disabled="!canStepForward"
        title="Step forward"
        @click="emit('stepForward')"
      >
        &#x23E9;
      </button>

      <!-- Step counter -->
      <span class="sim-counter">
        {{ currentStep }}/{{ totalSteps }}
      </span>

      <!-- Step slider -->
      <input
        class="sim-slider"
        type="range"
        :min="0"
        :max="totalSteps"
        :value="currentStep"
        :disabled="isComputing"
        @input="onSliderInput"
      />
    </template>
  </div>
</template>

<style scoped>
.sim-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 32px;
  background: var(--color-surface, #2a2a3e);
  border-bottom: 1px solid var(--color-border, #3a3a5e);
}

.sim-controls__divider {
  width: 1px;
  height: 18px;
  background: var(--color-border, #3a3a5e);
  margin: 0 4px;
}

.sim-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--color-border, #3a3a5e);
  border-radius: 3px;
  background: transparent;
  color: var(--color-text, #e0e0e0);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.sim-btn:hover:not(:disabled) {
  background: var(--color-hover, #3a3a5e);
}

.sim-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sim-btn--mode {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sim-btn--active {
  background: var(--color-accent, #4a6fa5);
  border-color: var(--color-accent, #4a6fa5);
}

.sim-btn--play {
  font-size: 14px;
}

.sim-counter {
  font-size: 11px;
  color: var(--color-text-secondary, #a0a0c0);
  min-width: 48px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.sim-slider {
  flex: 1;
  min-width: 80px;
  max-width: 200px;
  height: 4px;
  accent-color: var(--color-accent, #4a6fa5);
}
</style>

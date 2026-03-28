<script setup lang="ts">
/**
 * ViewSwitcher — camera view preset buttons for the 3D viewport.
 *
 * Renders a row of buttons: 3D | Top | Front | Right | Back | Left | Bottom
 * Active preset is highlighted.
 */

import { VIEW_PRESETS, type ViewPreset } from './cameraUtils'

const props = defineProps<{
  activeView: ViewPreset
}>()

const emit = defineEmits<{
  'update:activeView': [preset: ViewPreset]
}>()

const presetOrder: ViewPreset[] = ['perspective', 'top', 'front', 'right', 'back', 'left', 'bottom']
</script>

<template>
  <div class="view-switcher">
    <button
      v-for="preset in presetOrder"
      :key="preset"
      class="view-btn"
      :class="{ 'view-btn--active': activeView === preset }"
      :title="VIEW_PRESETS[preset].label + ' view'"
      @click="emit('update:activeView', preset)"
    >
      {{ VIEW_PRESETS[preset].label }}
    </button>
  </div>
</template>

<style scoped>
.view-switcher {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

.view-btn {
  padding: 3px 8px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, color 0.15s;
}

.view-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.view-btn--active {
  background: var(--color-accent, #4a6fa5);
  color: white;
}
</style>

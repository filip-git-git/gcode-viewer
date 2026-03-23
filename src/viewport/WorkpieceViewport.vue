<script setup lang="ts">
/**
 * WorkpieceViewport — TresJS 3D scene for displaying machined workpieces.
 *
 * Features:
 * - Renders workpiece BufferGeometry with dual materials (surface + core)
 * - Orbit controls (pan/rotate/zoom)
 * - Ambient + directional lighting
 * - Auto-frames camera to workpiece dimensions
 */

import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { computed, toRefs } from 'vue'
import { BufferGeometry, type Material } from 'three'
import {
  calculateCameraPosition,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from './cameraUtils'
import type { WorkpieceDimensions } from '../parser/types'

const props = defineProps<{
  geometry: BufferGeometry | null
  materials: Material[]
  dimensions: WorkpieceDimensions | null
}>()

const { geometry, dimensions } = toRefs(props)

const cameraSetup = computed(() => {
  if (dimensions.value) {
    return calculateCameraPosition(dimensions.value)
  }
  return {
    position: DEFAULT_CAMERA_POSITION,
    target: DEFAULT_CAMERA_TARGET,
  }
})

const cameraPos = computed(
  () =>
    [cameraSetup.value.position.x, cameraSetup.value.position.y, cameraSetup.value.position.z] as [
      number,
      number,
      number,
    ],
)

const lookAt = computed(
  () =>
    [cameraSetup.value.target.x, cameraSetup.value.target.y, cameraSetup.value.target.z] as [
      number,
      number,
      number,
    ],
)
</script>

<template>
  <div class="viewport-container">
    <TresCanvas clear-color="#1a1a2e">
      <TresPerspectiveCamera :position="cameraPos" :look-at="lookAt" :fov="50" :near="1" :far="10000" />
      <OrbitControls :target="lookAt" />

      <!-- Lighting -->
      <TresAmbientLight :intensity="0.4" />
      <TresDirectionalLight :position="[500, -500, 800]" :intensity="0.8" />
      <TresDirectionalLight :position="[-300, 300, 400]" :intensity="0.3" />

      <!-- Workpiece mesh with dual materials (surface laminate + exposed core) -->
      <TresMesh v-if="geometry" :geometry="geometry" :material="materials" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.viewport-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
}
</style>

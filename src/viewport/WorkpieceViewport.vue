<script setup lang="ts">
/**
 * WorkpieceViewport — TresJS 3D scene for displaying machined workpieces.
 *
 * Features:
 * - Renders workpiece BufferGeometry with dual materials (surface + core)
 * - Orbit controls (pan/rotate/zoom)
 * - Ambient + directional lighting
 * - Auto-frames camera to workpiece dimensions
 * - View switching: perspective + 6 orthographic presets
 */

import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { computed, ref, toRefs, watch, onMounted, onUnmounted } from 'vue'
import { BufferGeometry, type Material } from 'three'
import ViewSwitcher from './ViewSwitcher.vue'
import {
  calculatePresetCamera,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  type ViewPreset,
} from './cameraUtils'
import type { WorkpieceDimensions } from '../parser/types'

const props = defineProps<{
  geometry: BufferGeometry | null
  materials: Material[]
  dimensions: WorkpieceDimensions | null
}>()

const { geometry, dimensions } = toRefs(props)

const activeView = ref<ViewPreset>('perspective')

// Track viewport container aspect ratio for orthographic camera
const containerRef = ref<HTMLElement | null>(null)
const aspectRatio = ref(1)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) {
      const { width, height } = entry.contentRect
      aspectRatio.value = height > 0 ? width / height : 1
    }
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

const cameraSetup = computed(() => {
  if (dimensions.value) {
    return calculatePresetCamera(activeView.value, dimensions.value)
  }
  return {
    position: DEFAULT_CAMERA_POSITION,
    target: DEFAULT_CAMERA_TARGET,
    up: { x: 0, y: 0, z: 1 },
    isOrthographic: false,
    orthoSize: 500,
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

const upVec = computed(
  () =>
    [cameraSetup.value.up.x, cameraSetup.value.up.y, cameraSetup.value.up.z] as [
      number,
      number,
      number,
    ],
)

// Ortho frustum — horizontal extent scaled by aspect ratio so pixels map 1:1
const orthoHalf = computed(() => cameraSetup.value.orthoSize)
const orthoHalfH = computed(() => orthoHalf.value * aspectRatio.value)

// Reset to perspective when workpiece changes
watch(dimensions, () => {
  activeView.value = 'perspective'
})
</script>

<template>
  <div ref="containerRef" class="viewport-container">
    <ViewSwitcher v-model:active-view="activeView" />

    <TresCanvas clear-color="#1a1a2e" :key="cameraSetup.isOrthographic ? 'ortho' : 'persp'">
      <!-- Perspective camera -->
      <TresPerspectiveCamera
        v-if="!cameraSetup.isOrthographic"
        :position="cameraPos"
        :look-at="lookAt"
        :up="upVec"
        :fov="50"
        :near="1"
        :far="10000"
      />

      <!-- Orthographic camera -->
      <TresOrthographicCamera
        v-else
        :position="cameraPos"
        :look-at="lookAt"
        :up="upVec"
        :left="-orthoHalfH"
        :right="orthoHalfH"
        :top="orthoHalf"
        :bottom="-orthoHalf"
        :near="-10000"
        :far="10000"
      />

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
  position: relative;
}
</style>

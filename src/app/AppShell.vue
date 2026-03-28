<script setup lang="ts">
/**
 * AppShell — main application layout.
 *
 * Structure:
 *   ┌──────────────────────────────────┐
 *   │           Toolbar                │
 *   ├───────────┬──┬───────────────────┤
 *   │           │  │                   │
 *   │  Editor   │▌ │    Viewport       │
 *   │  Panel    │  │    (3D)           │
 *   │           │  │                   │
 *   ├───────────┴──┴───────────────────┤
 *   │           Status Bar             │
 *   └──────────────────────────────────┘
 */

import { ref, computed, onUnmounted } from 'vue'
import Toolbar from './Toolbar.vue'
import StatusBar from './StatusBar.vue'
import SplitPane from './SplitPane.vue'
import SimulationControls from './SimulationControls.vue'
import DimensionDialog from './DimensionDialog.vue'
import EditorPanel from '../editor/EditorPanel.vue'
import WorkpieceViewport from '../viewport/WorkpieceViewport.vue'
import ToolDatabasePanel from '../tools/ToolDatabasePanel.vue'
import VerificationReport from './VerificationReport.vue'
import { useGCodePipeline } from './useGCodePipeline'
import type { ParseWarning } from '../parser/types'

const pipeline = useGCodePipeline()

const cursorLine = ref(1)
const cursorCol = ref(1)
const showToolPanel = ref(false)
const showDimDialog = ref(false)
const showVerification = ref(false)

// Combine all warnings for the status bar
const allWarnings = computed<ParseWarning[]>(() => [
  ...pipeline.parseWarnings.value,
  ...pipeline.simWarnings.value.map((w) => ({
    line: w.lineNumber,
    message: w.message,
    token: '',
  })),
])

function handleFileDrop(name: string, content: string): void {
  pipeline.loadFile(name, content)
}

function handleCursorChange(line: number, col: number): void {
  cursorLine.value = line
  cursorCol.value = col
}

// Keyboard shortcut: Ctrl+O for file open
function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.key === 'o') {
    e.preventDefault()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    input?.click()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onGlobalKeyDown)
  onUnmounted(() => {
    window.removeEventListener('keydown', onGlobalKeyDown)
  })
}
</script>

<template>
  <div class="app-shell">
    <Toolbar
      :file-name="pipeline.fileName.value"
      :is-processing="pipeline.isProcessing.value"
      :has-workpiece="pipeline.scene.hasWorkpiece.value"
      :operation-count="pipeline.operationCount.value"
      :csg-time-ms="pipeline.scene.totalCsgTimeMs.value"
      @toggle-tools="showToolPanel = !showToolPanel"
      @open-dimensions="showDimDialog = true"
      @open-verification="showVerification = true"
      @load-file="handleFileDrop"
    />

    <SimulationControls
      :current-step="pipeline.playback.currentStep.value"
      :total-steps="pipeline.playback.totalSteps.value"
      :is-playing="pipeline.playback.isPlaying.value"
      :is-step-mode="pipeline.playback.isStepMode.value"
      :is-computing="pipeline.playback.isComputing.value"
      :has-workpiece="pipeline.scene.hasWorkpiece.value"
      @step-forward="pipeline.playback.stepForward()"
      @step-back="pipeline.playback.stepBack()"
      @play="pipeline.playback.play()"
      @pause="pipeline.playback.pause()"
      @reset="pipeline.playback.reset()"
      @enter-step-mode="pipeline.playback.enterStepMode()"
      @exit-step-mode="pipeline.playback.exitStepMode()"
      @go-to-step="pipeline.playback.goToStep($event)"
    />

    <main class="app-shell__main">
      <SplitPane>
        <template #left>
          <EditorPanel
            :model-value="pipeline.gcodeText.value"
            :highlight-line="pipeline.playback.currentLineNumber.value"
            @update:model-value="pipeline.gcodeText.value = $event"
            @cursor-change="handleCursorChange"
            @file-drop="handleFileDrop"
          />
        </template>
        <template #right>
          <WorkpieceViewport
            :geometry="pipeline.scene.geometry.value"
            :materials="pipeline.scene.materials"
            :dimensions="pipeline.dimensions.value"
          />
        </template>
      </SplitPane>
    </main>

    <StatusBar
      :warnings="allWarnings"
      :file-name="pipeline.fileName.value"
      :line-count="pipeline.lineCount.value"
      :cursor-line="cursorLine"
      :cursor-col="cursorCol"
      :dimensions="pipeline.dimensions.value"
      :is-processing="pipeline.isProcessing.value"
    />

    <ToolDatabasePanel
      :open="showToolPanel"
      @close="showToolPanel = false"
    />

    <DimensionDialog
      :open="showDimDialog"
      :current-dimensions="pipeline.dimensions.value"
      @close="showDimDialog = false"
      @apply="pipeline.setManualDimensions"
    />

    <VerificationReport
      :open="showVerification"
      :parse-warnings="pipeline.parseWarnings.value"
      :sim-warnings="pipeline.simWarnings.value"
      :dimensions="pipeline.dimensions.value"
      :operation-count="pipeline.operationCount.value"
      :tools-used="pipeline.toolsUsed.value"
      :has-file="!!pipeline.fileName.value"
      @close="showVerification = false"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

.app-shell__main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>

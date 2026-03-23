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

import { ref, computed } from 'vue'
import Toolbar from './Toolbar.vue'
import StatusBar from './StatusBar.vue'
import SplitPane from './SplitPane.vue'
import DimensionDialog from './DimensionDialog.vue'
import EditorPanel from '../editor/EditorPanel.vue'
import WorkpieceViewport from '../viewport/WorkpieceViewport.vue'
import ToolDatabasePanel from '../tools/ToolDatabasePanel.vue'
import { useGCodePipeline } from './useGCodePipeline'
import type { ParseWarning } from '../parser/types'

const pipeline = useGCodePipeline()

const cursorLine = ref(1)
const cursorCol = ref(1)
const showToolPanel = ref(false)
const showDimDialog = ref(false)

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
      @load-file="handleFileDrop"
    />

    <main class="app-shell__main">
      <SplitPane>
        <template #left>
          <EditorPanel
            :model-value="pipeline.gcodeText.value"
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

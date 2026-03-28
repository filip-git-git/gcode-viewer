<script setup lang="ts">
/**
 * ToolDatabasePanel — slide-out panel for managing the tool database.
 *
 * Shows tool list as a table, with add/edit/delete actions.
 * Uses the Pinia tool store for reactive state.
 */

import { ref, computed } from 'vue'
import { useToolStore } from './useToolStore'
import type { ToolDefinition, TipType } from './types'

defineProps<{
  open: boolean
}>()

defineEmits<{
  close: []
}>()

const toolStore = useToolStore()
const editingTool = ref<ToolDefinition | null>(null)
const isAdding = ref(false)
const deleteConfirm = ref<number | null>(null)

const TIP_TYPE_LABELS: Record<TipType, string> = {
  'flat-end-mill': 'Flat End Mill',
  'ball-end-mill': 'Ball End Mill',
  'bull-nose': 'Bull Nose',
  'drill': 'Drill',
  'forstner': 'Forstner',
}

const TIP_TYPES: TipType[] = ['flat-end-mill', 'ball-end-mill', 'bull-nose', 'drill', 'forstner']

/** Whether the current tipType has a configurable tip angle */
function hasTipAngle(tipType: TipType): boolean {
  return tipType === 'drill' || tipType === 'forstner'
}

/** Whether the current tipType has a corner radius */
function hasCornerRadius(tipType: TipType): boolean {
  return tipType === 'bull-nose'
}

function onTipTypeChange(tipType: TipType): void {
  if (!editingTool.value) return
  // Set sensible defaults when switching to a type with extra params
  if (hasTipAngle(tipType) && editingTool.value.tipAngle === undefined) {
    editingTool.value.tipAngle = 118
  }
  if (hasCornerRadius(tipType) && editingTool.value.cornerRadius === undefined) {
    editingTool.value.cornerRadius = 1
  }
}

const sortedTools = computed(() =>
  [...toolStore.tools].sort((a, b) => a.toolNumber - b.toolNumber),
)

function startAdd(): void {
  const maxNumber = toolStore.tools.reduce((max, t) => Math.max(max, t.toolNumber), 0)
  editingTool.value = {
    toolNumber: maxNumber + 1,
    name: '',
    diameter: 6,
    tipType: 'flat-end-mill',
    cuttingLength: 25,
  }
  isAdding.value = true
}

function startEdit(tool: ToolDefinition): void {
  editingTool.value = { ...tool }
  isAdding.value = false
}

function saveTool(): void {
  if (!editingTool.value) return
  if (toolStore.save(editingTool.value)) {
    editingTool.value = null
  }
}

function cancelEdit(): void {
  editingTool.value = null
  toolStore.clearError()
}

function confirmDelete(toolNumber: number): void {
  deleteConfirm.value = toolNumber
}

function executeDelete(): void {
  if (deleteConfirm.value !== null) {
    toolStore.remove(deleteConfirm.value)
    deleteConfirm.value = null
  }
}

function resetDefaults(): void {
  toolStore.reset()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="open" class="tool-panel-overlay" @click.self="$emit('close')">
        <aside class="tool-panel" role="dialog" aria-label="Tool database">
          <div class="tool-panel__header">
            <h2 class="tool-panel__title">Tool Database</h2>
            <div class="tool-panel__header-actions">
              <button class="tool-panel__btn-icon" title="Add tool" @click="startAdd">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                </svg>
              </button>
              <button class="tool-panel__btn-icon" @click="$emit('close')" aria-label="Close">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Edit Form -->
          <div class="tool-panel__edit" v-if="editingTool">
            <h3 class="tool-panel__edit-title">
              {{ isAdding ? 'Add Tool' : `Edit T${editingTool.toolNumber}` }}
            </h3>

            <div class="tool-panel__form">
              <label class="tool-panel__field">
                <span>Tool Number</span>
                <input
                  v-model.number="editingTool.toolNumber"
                  type="number"
                  min="1"
                  :disabled="!isAdding"
                />
              </label>

              <label class="tool-panel__field">
                <span>Name</span>
                <input v-model="editingTool.name" type="text" placeholder="e.g., 6mm Flat End Mill" />
              </label>

              <label class="tool-panel__field">
                <span>Diameter (mm)</span>
                <input v-model.number="editingTool.diameter" type="number" min="0.1" step="0.1" />
              </label>

              <label class="tool-panel__field">
                <span>Tip Type</span>
                <select v-model="editingTool.tipType" @change="onTipTypeChange(editingTool!.tipType)">
                  <option v-for="tt in TIP_TYPES" :key="tt" :value="tt">
                    {{ TIP_TYPE_LABELS[tt] }}
                  </option>
                </select>
              </label>

              <label v-if="hasTipAngle(editingTool.tipType)" class="tool-panel__field">
                <span>Tip Angle (°)</span>
                <input
                  v-model.number="editingTool.tipAngle"
                  type="number"
                  min="1"
                  max="179"
                  step="1"
                  placeholder="118"
                />
              </label>

              <label v-if="hasCornerRadius(editingTool.tipType)" class="tool-panel__field">
                <span>Corner Radius (mm)</span>
                <input
                  v-model.number="editingTool.cornerRadius"
                  type="number"
                  min="0.1"
                  step="0.1"
                />
              </label>

              <label class="tool-panel__field">
                <span>Cutting Length (mm)</span>
                <input v-model.number="editingTool.cuttingLength" type="number" min="0.1" step="0.5" />
              </label>
            </div>

            <p class="tool-panel__error" v-if="toolStore.error">{{ toolStore.error }}</p>

            <div class="tool-panel__edit-actions">
              <button class="tool-panel__btn tool-panel__btn--secondary" @click="cancelEdit">Cancel</button>
              <button class="tool-panel__btn tool-panel__btn--primary" @click="saveTool">
                {{ isAdding ? 'Add' : 'Save' }}
              </button>
            </div>
          </div>

          <!-- Tool List -->
          <div class="tool-panel__list" v-else>
            <table class="tool-panel__table" v-if="sortedTools.length > 0">
              <thead>
                <tr>
                  <th>T#</th>
                  <th>Name</th>
                  <th>Dia</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="tool in sortedTools"
                  :key="tool.toolNumber"
                  @click="startEdit(tool)"
                >
                  <td class="tool-panel__cell-number">T{{ tool.toolNumber }}</td>
                  <td>{{ tool.name }}</td>
                  <td class="tool-panel__cell-dim">{{ tool.diameter }}mm</td>
                  <td class="tool-panel__cell-type">
                    <span class="tool-panel__badge" :data-type="tool.tipType">
                      {{ TIP_TYPE_LABELS[tool.tipType] }}
                    </span>
                  </td>
                  <td class="tool-panel__cell-actions">
                    <button
                      class="tool-panel__btn-icon tool-panel__btn-delete"
                      title="Delete"
                      @click.stop="confirmDelete(tool.toolNumber)"
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                        <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zM11 3h3.25a.75.75 0 010 1.5H13.2l-.82 8.199A1.5 1.5 0 0110.886 14H5.114a1.5 1.5 0 01-1.494-1.301L2.8 4.5H1.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75V3z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="tool-panel__empty" v-else>
              <p>No tools in database</p>
              <button class="tool-panel__btn tool-panel__btn--secondary" @click="resetDefaults">
                Restore Defaults
              </button>
            </div>
          </div>

          <!-- Delete Confirmation -->
          <Teleport to="body">
            <div class="dialog-overlay" v-if="deleteConfirm !== null" @click.self="deleteConfirm = null">
              <div class="dialog" style="width: 320px;">
                <div class="dialog__body" style="padding: 20px;">
                  <p style="color: var(--color-text); margin: 0 0 16px; font-family: var(--font-ui); font-size: 13px;">
                    Delete tool T{{ deleteConfirm }}?
                  </p>
                  <div class="dialog__footer" style="border: none; padding: 0; justify-content: flex-end;">
                    <button class="dialog__btn dialog__btn--secondary" @click="deleteConfirm = null">Cancel</button>
                    <button class="dialog__btn" style="background: var(--color-error); border-color: var(--color-error); color: white;" @click="executeDelete">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </Teleport>

          <div class="tool-panel__footer" v-if="!editingTool">
            <span class="tool-panel__count">{{ sortedTools.length }} tools</span>
            <button class="tool-panel__btn-text" @click="resetDefaults">Reset to defaults</button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Panel overlay */
.tool-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 900;
  display: flex;
  justify-content: flex-end;
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.15s;
}

.panel-enter-active .tool-panel,
.panel-leave-active .tool-panel {
  transition: transform 0.2s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

.panel-enter-from .tool-panel,
.panel-leave-to .tool-panel {
  transform: translateX(100%);
}

/* Panel */
.tool-panel {
  width: 380px;
  max-width: 90vw;
  height: 100%;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.3);
}

.tool-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tool-panel__title {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.tool-panel__header-actions {
  display: flex;
  gap: 4px;
}

.tool-panel__btn-icon {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  display: flex;
}

.tool-panel__btn-icon:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

/* Tool list */
.tool-panel__list {
  flex: 1;
  overflow-y: auto;
}

.tool-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-ui);
  font-size: 12px;
}

.tool-panel__table th {
  text-align: left;
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-surface);
}

.tool-panel__table td {
  padding: 8px 12px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-subtle, rgba(48, 54, 61, 0.5));
}

.tool-panel__table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.tool-panel__table tbody tr:hover {
  background: var(--color-hover);
}

.tool-panel__cell-number {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-amber) !important;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.tool-panel__cell-dim {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.tool-panel__badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 500;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
}

.tool-panel__badge[data-type="flat-end-mill"] {
  color: #7ee787;
  border-color: rgba(126, 231, 135, 0.2);
}

.tool-panel__badge[data-type="ball-end-mill"] {
  color: #d2a8ff;
  border-color: rgba(210, 168, 255, 0.2);
}

.tool-panel__badge[data-type="drill"] {
  color: #58a6ff;
  border-color: rgba(88, 166, 255, 0.2);
}

.tool-panel__badge[data-type="forstner"] {
  color: #79c0ff;
  border-color: rgba(121, 192, 255, 0.2);
}

.tool-panel__badge[data-type="bull-nose"] {
  color: #ffa657;
  border-color: rgba(255, 166, 87, 0.2);
}

.tool-panel__btn-delete {
  opacity: 0;
  color: var(--color-error) !important;
}

.tool-panel__table tbody tr:hover .tool-panel__btn-delete {
  opacity: 1;
}

.tool-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--color-text-muted);
  font-family: var(--font-ui);
  font-size: 13px;
}

/* Edit form */
.tool-panel__edit {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.tool-panel__edit-title {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px;
}

.tool-panel__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-panel__field span {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
  letter-spacing: 0.3px;
}

.tool-panel__field input,
.tool-panel__field select {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 0.15s;
}

.tool-panel__field input:focus,
.tool-panel__field select:focus {
  border-color: var(--color-amber);
  box-shadow: 0 0 0 1px rgba(232, 168, 56, 0.2);
}

.tool-panel__field input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tool-panel__field select {
  cursor: pointer;
}

.tool-panel__error {
  color: var(--color-error);
  font-family: var(--font-ui);
  font-size: 12px;
  margin: 12px 0 0;
}

.tool-panel__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.tool-panel__btn {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.12s;
}

.tool-panel__btn--secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.tool-panel__btn--secondary:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.tool-panel__btn--primary {
  background: var(--color-amber);
  border: 1px solid var(--color-amber);
  color: #0d1117;
  font-weight: 600;
}

.tool-panel__btn--primary:hover {
  background: #d49830;
}

/* Footer */
.tool-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tool-panel__count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}

.tool-panel__btn-text {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-ui);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}

.tool-panel__btn-text:hover {
  color: var(--color-text-secondary);
  text-decoration: underline;
}
</style>

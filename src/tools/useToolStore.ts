/**
 * Pinia store for tool database — reactive wrapper around toolService.
 *
 * Provides reactive state for Vue components while delegating
 * persistence to the localStorage-backed toolService.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ToolDefinition } from './types'
import {
  getAllTools,
  saveTool,
  removeTool,
  resetToDefaults,
  ToolValidationError,
} from './toolService'

export const useToolStore = defineStore('tools', () => {
  const tools = ref<ToolDefinition[]>(getAllTools())
  const error = ref<string | null>(null)

  function refresh(): void {
    tools.value = getAllTools()
    error.value = null
  }

  function save(tool: ToolDefinition): boolean {
    try {
      saveTool(tool)
      refresh()
      return true
    } catch (e) {
      if (e instanceof ToolValidationError) {
        error.value = e.message
      } else {
        error.value = 'Failed to save tool'
      }
      return false
    }
  }

  function remove(toolNumber: number): boolean {
    const removed = removeTool(toolNumber)
    if (removed) {
      refresh()
    }
    return removed
  }

  function reset(): void {
    resetToDefaults()
    refresh()
  }

  function clearError(): void {
    error.value = null
  }

  function getByNumber(toolNumber: number): ToolDefinition | undefined {
    return tools.value.find((t) => t.toolNumber === toolNumber)
  }

  return {
    tools,
    error,
    refresh,
    save,
    remove,
    reset,
    clearError,
    getByNumber,
  }
})

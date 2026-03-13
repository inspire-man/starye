/**
 * 批量选择逻辑 Composable
 */

import type { Ref } from 'vue'
import { computed, ref } from 'vue'

export function useBatchSelect<T extends { id: string }>(items: Ref<T[]>) {
  const selected = ref<Set<string>>(new Set())

  const toggleItem = (id: string) => {
    if (selected.value.has(id)) {
      selected.value.delete(id)
    }
    else {
      selected.value.add(id)
    }
    selected.value = new Set(selected.value)
  }

  const toggleAll = () => {
    if (selected.value.size === items.value.length) {
      selected.value.clear()
    }
    else {
      items.value.forEach(item => selected.value.add(item.id))
    }
    selected.value = new Set(selected.value)
  }

  const clearSelection = () => {
    selected.value.clear()
    selected.value = new Set(selected.value)
  }

  const selectedCount = computed(() => selected.value.size)
  const selectedIds = computed(() => [...selected.value])
  const selectedItems = computed(() =>
    items.value.filter(item => selected.value.has(item.id)),
  )

  return {
    selected,
    toggleItem,
    toggleAll,
    clearSelection,
    selectedCount,
    selectedIds,
    selectedItems,
  }
}

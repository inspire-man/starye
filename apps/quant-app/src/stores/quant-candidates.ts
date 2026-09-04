import type { CandidateResearchStatus, CandidateReviewFilter, CandidateSortKey, SelectionPresetKey } from '../lib/selection-presets'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const MAX_COMPARISON_CANDIDATES = 3

export const useQuantCandidatesStore = defineStore('quant-candidates', () => {
  const candidateFilter = ref<SelectionPresetKey>('balanced')
  const candidateMinScore = ref(0)
  const candidateCompleteOnly = ref(false)
  const candidateSort = ref<CandidateSortKey>('researchPriority')
  const candidateResearchStatus = ref<CandidateResearchStatus>('all')
  const candidateReviewDue = ref<CandidateReviewFilter>('all')
  const selectedCandidateIds = ref<Set<string>>(new Set())

  function resetQuery(): void {
    candidateMinScore.value = 0
    candidateCompleteOnly.value = false
    candidateSort.value = 'researchPriority'
    candidateResearchStatus.value = 'all'
    candidateReviewDue.value = 'all'
  }

  function toggleSelection(id: string): void {
    const next = new Set(selectedCandidateIds.value)
    if (next.has(id))
      next.delete(id)
    else if (next.size < MAX_COMPARISON_CANDIDATES)
      next.add(id)
    selectedCandidateIds.value = next
  }

  function toggleAllSelection(visibleIds: readonly string[]): void {
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedCandidateIds.value.has(id))
    const next = new Set(selectedCandidateIds.value)
    if (allVisibleSelected) {
      visibleIds.forEach(id => next.delete(id))
    }
    else {
      visibleIds.forEach((id) => {
        if (next.size < MAX_COMPARISON_CANDIDATES)
          next.add(id)
      })
    }
    selectedCandidateIds.value = next
  }

  function clearSelection(): void {
    selectedCandidateIds.value = new Set()
  }

  function pruneSelection(allowedIds: ReadonlySet<string>): void {
    selectedCandidateIds.value = new Set([...selectedCandidateIds.value].filter(id => allowedIds.has(id)))
  }

  return {
    candidateFilter,
    candidateMinScore,
    candidateCompleteOnly,
    candidateSort,
    candidateResearchStatus,
    candidateReviewDue,
    selectedCandidateIds,
    resetQuery,
    toggleSelection,
    toggleAllSelection,
    clearSelection,
    pruneSelection,
  }
})

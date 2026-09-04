import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useQuantCandidatesStore } from '../quant-candidates'

describe('quant candidates store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('limits comparison selection to three candidates and prunes stale ids', () => {
    const store = useQuantCandidatesStore()
    store.toggleSelection('one')
    store.toggleSelection('two')
    store.toggleSelection('three')
    store.toggleSelection('four')

    expect([...store.selectedCandidateIds]).toEqual(['one', 'two', 'three'])

    store.pruneSelection(new Set(['one', 'three']))
    expect([...store.selectedCandidateIds]).toEqual(['one', 'three'])
  })

  it('resets filters and handles visible selection as a group', () => {
    const store = useQuantCandidatesStore()
    store.candidateMinScore = 4
    store.candidateCompleteOnly = true
    store.candidateReviewDue = 'overdue'
    store.toggleAllSelection(['one', 'two', 'three', 'four'])

    expect([...store.selectedCandidateIds]).toEqual(['one', 'two', 'three'])
    store.resetQuery()
    expect(store.candidateMinScore).toBe(0)
    expect(store.candidateCompleteOnly).toBe(false)
    expect(store.candidateReviewDue).toBe('all')
  })
})

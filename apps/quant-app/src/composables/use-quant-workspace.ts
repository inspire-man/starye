import type { QuantAiReviewOutcomeBoard, QuantInvalidationItem, QuantPriceLocation } from '../api/resources/research'
import type {
  QuantDecisionRecord,
  QuantInvestmentKnowledge,
  QuantResearchMarker,
  QuantShareholderReturnSelection,
  QuantValueSelection,
  SyncResult,
} from '../lib/quant-view-models'
import type { QuantRequestState } from './use-quant-request'
import { ref } from 'vue'
import { quantApi } from '../lib/api-client'
import { useQuantRequestState } from './use-quant-request'

export interface QuantWorkspaceLoadingState {
  valueQuality: boolean
  shareholderReturns: boolean
  knowledge: boolean
  research: boolean
  syncState: boolean
}

export interface QuantWorkspaceErrorState {
  valueQuality: unknown | null
  shareholderReturns: unknown | null
  knowledge: unknown | null
  research: unknown | null
}

export function useQuantWorkspace(input: {
  loading: QuantWorkspaceLoadingState
  errors: QuantWorkspaceErrorState
}) {
  const decisionQueueRecords = ref<QuantDecisionRecord[]>([])
  const decisionQueueLoading = ref(false)
  const decisionQueueError = ref<unknown | null>(null)
  const priceLocations = ref<QuantPriceLocation[]>([])
  const priceLocationsLoading = ref(false)
  const priceLocationsError = ref<unknown | null>(null)
  const aiReviewOutcomes = ref<QuantAiReviewOutcomeBoard | null>(null)
  const aiReviewOutcomesLoading = ref(false)
  const aiReviewOutcomesError = ref<unknown | null>(null)
  const invalidationChecks = ref<QuantInvalidationItem[]>([])
  const invalidationChecksLoading = ref(false)
  const invalidationChecksError = ref<unknown | null>(null)
  const valueSelection = ref<QuantValueSelection | null>(null)
  const shareholderReturns = ref<QuantShareholderReturnSelection | null>(null)
  const investmentKnowledge = ref<QuantInvestmentKnowledge | null>(null)
  const researchMarkers = ref<QuantResearchMarker[]>([])
  const syncState = ref<SyncResult | null>(null)
  const syncStateError = ref<unknown | null>(null)

  const decisionQueueRequest = useQuantRequestState<QuantDecisionRecord[]>([])
  const valueQualityRequest = useQuantRequestState<QuantValueSelection>()
  const shareholderReturnRequest = useQuantRequestState<QuantShareholderReturnSelection>()
  const knowledgeRequest = useQuantRequestState<QuantInvestmentKnowledge>()
  const syncStateRequest = useQuantRequestState<SyncResult | null>(null)
  const researchMarkersRequest = useQuantRequestState<QuantResearchMarker[]>([])
  const priceLocationRequest = useQuantRequestState<QuantPriceLocation[]>([])
  const aiReviewOutcomeRequest = useQuantRequestState<QuantAiReviewOutcomeBoard | null>(null)
  const invalidationCheckRequest = useQuantRequestState<QuantInvalidationItem[]>([])

  async function loadResource<T>(request: {
    request: QuantRequestState<T>
    loader: (signal: AbortSignal) => Promise<T>
    setLoading: (value: boolean) => void
    setError: (value: unknown | null) => void
    apply: (value: T) => void
  }): Promise<void> {
    request.setLoading(true)
    request.setError(null)
    try {
      const result = await request.request.run(request.loader)
      if (result !== undefined)
        request.apply(result)
    }
    catch (error) {
      request.setError(error)
    }
    finally {
      request.setLoading(request.request.loading.value)
    }
  }

  async function loadDecisionQueue(): Promise<void> {
    await loadResource({
      request: decisionQueueRequest,
      loader: signal => quantApi.getResearchDecisionQueue(20, { signal }),
      setLoading: value => decisionQueueLoading.value = value,
      setError: value => decisionQueueError.value = value,
      apply: value => decisionQueueRecords.value = value,
    })
  }

  async function loadPriceLocations(): Promise<void> {
    await loadResource({
      request: priceLocationRequest,
      loader: signal => quantApi.getPriceLocations({ signal }),
      setLoading: value => priceLocationsLoading.value = value,
      setError: value => priceLocationsError.value = value,
      apply: value => priceLocations.value = value,
    })
  }

  async function loadAiReviewOutcomes(): Promise<void> {
    await loadResource({
      request: aiReviewOutcomeRequest,
      loader: signal => quantApi.getAiReviewOutcomes({ signal }),
      setLoading: value => aiReviewOutcomesLoading.value = value,
      setError: value => aiReviewOutcomesError.value = value,
      apply: value => aiReviewOutcomes.value = value,
    })
  }

  async function loadInvalidationChecks(): Promise<void> {
    await loadResource({
      request: invalidationCheckRequest,
      loader: signal => quantApi.getInvalidationChecks({ signal }),
      setLoading: value => invalidationChecksLoading.value = value,
      setError: value => invalidationChecksError.value = value,
      apply: value => invalidationChecks.value = value,
    })
  }

  async function loadValueSelection(): Promise<void> {
    await loadResource({
      request: valueQualityRequest,
      loader: signal => quantApi.getValueSelection({ signal }),
      setLoading: value => input.loading.valueQuality = value,
      setError: value => input.errors.valueQuality = value,
      apply: value => valueSelection.value = value,
    })
  }

  function invalidateValueSelection(): void {
    valueQualityRequest.cancel()
    valueSelection.value = null
    input.errors.valueQuality = null
    input.loading.valueQuality = false
  }

  async function loadShareholderReturns(): Promise<void> {
    await loadResource({
      request: shareholderReturnRequest,
      loader: signal => quantApi.getShareholderReturns({ signal }),
      setLoading: value => input.loading.shareholderReturns = value,
      setError: value => input.errors.shareholderReturns = value,
      apply: value => shareholderReturns.value = value,
    })
  }

  function invalidateShareholderReturns(): void {
    shareholderReturnRequest.cancel()
    shareholderReturns.value = null
    input.errors.shareholderReturns = null
    input.loading.shareholderReturns = false
  }

  async function loadInvestmentKnowledge(): Promise<void> {
    await loadResource({
      request: knowledgeRequest,
      loader: signal => quantApi.getInvestmentKnowledge({ signal }),
      setLoading: value => input.loading.knowledge = value,
      setError: value => input.errors.knowledge = value,
      apply: value => investmentKnowledge.value = value,
    })
  }

  async function loadSyncState(): Promise<void> {
    await loadResource({
      request: syncStateRequest,
      loader: signal => quantApi.getSyncState({ signal }),
      setLoading: value => input.loading.syncState = value,
      setError: value => syncStateError.value = value,
      apply: value => syncState.value = value,
    })
  }

  async function loadResearchMarkers(): Promise<void> {
    await loadResource({
      request: researchMarkersRequest,
      loader: signal => quantApi.getResearchMarkers({ signal }),
      setLoading: value => input.loading.research = value,
      setError: value => input.errors.research = value,
      apply: value => researchMarkers.value = value,
    })
  }

  function cancelWorkspaceRequests(): void {
    decisionQueueRequest.cancel()
    priceLocationRequest.cancel()
    aiReviewOutcomeRequest.cancel()
    invalidationCheckRequest.cancel()
    valueQualityRequest.cancel()
    shareholderReturnRequest.cancel()
    knowledgeRequest.cancel()
    syncStateRequest.cancel()
    researchMarkersRequest.cancel()
    input.loading.valueQuality = false
    input.loading.shareholderReturns = false
    input.loading.knowledge = false
    input.loading.syncState = false
    input.loading.research = false
  }

  return {
    decisionQueueRecords,
    decisionQueueLoading,
    decisionQueueError,
    priceLocations,
    priceLocationsLoading,
    priceLocationsError,
    aiReviewOutcomes,
    aiReviewOutcomesLoading,
    aiReviewOutcomesError,
    invalidationChecks,
    invalidationChecksLoading,
    invalidationChecksError,
    valueSelection,
    shareholderReturns,
    investmentKnowledge,
    researchMarkers,
    syncState,
    syncStateError,
    loadDecisionQueue,
    loadPriceLocations,
    loadAiReviewOutcomes,
    loadInvalidationChecks,
    loadValueSelection,
    invalidateValueSelection,
    loadShareholderReturns,
    invalidateShareholderReturns,
    loadInvestmentKnowledge,
    loadSyncState,
    loadResearchMarkers,
    cancelWorkspaceRequests,
  }
}

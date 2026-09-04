import type {
  QuantAiProvider,
  QuantAiResponseMode,
  QuantDecisionAssistantMode,
  QuantFactorWeights,
  ResearchMarkerStatus,
} from '../lib/quant-view-models'

/** Transport envelope emitted by the Quant Gateway/API boundary. */
export interface QuantApiEnvelope<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  code?: string
  requestId?: string
  request_id?: string
  timestamp?: string
}

export interface AddWatchlistRequestDto {
  ts_code: string
  name?: string
}

export interface UpdateWatchlistNameRequestDto {
  name: string
}

export interface DailyBarQueryDto {
  from?: string
  to?: string
  limit?: number
}

export interface UpdateAiConfigRequestDto {
  provider: QuantAiProvider
  model: string
  base_url?: string | null
  response_mode?: QuantAiResponseMode
  generation_timeout_ms?: number
  api_key?: string
  clear_api_key?: boolean
}

export interface UpdateFactorConfigurationRequestDto {
  weights: QuantFactorWeights
}

export interface GenerateCandidateAiBriefingRequestDto {
  ts_codes?: string[]
}

export interface AskCandidateAiBriefingQuestionRequestDto {
  ts_codes: string[]
  question: string
  session_id?: string
}

export interface CreateDecisionAssistantRequestDto {
  research_run_id: string
  mode: QuantDecisionAssistantMode
  cost_basis?: number | null
  quantity?: number | null
  include_ai?: boolean
}

export interface GenerateResearchRunRequestDto {
  ts_code: string
}

export interface GenerateResearchComparisonRequestDto {
  run_ids: string[]
}

export interface AskResearchQuestionRequestDto {
  question: string
}

export interface GenerateResearchChangeExplanationRequestDto {
  previous_run_id: string
}

export interface UpdateResearchMarkerRequestDto {
  status: ResearchMarkerStatus
  note: string | null
  review_date: string | null
}

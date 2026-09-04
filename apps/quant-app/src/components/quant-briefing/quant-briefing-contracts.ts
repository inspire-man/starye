import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingQuestion, QuantAiCandidateBriefingSession } from '../../lib/quant-view-models'

export type QuantAiBriefingCopyOutcome = 'success' | 'error' | null

export interface QuantAiCandidateBriefingHeaderProps {
  briefing: QuantAiCandidateBriefing | null
  candidateCount: number
  filteredCandidateCount: number
  briefingAvailableCandidateCount: number
  briefingCandidateCount: number | null
  available: boolean
  loading: boolean
  errorMessage: string | null
  copying: boolean
}

export interface QuantAiCandidateBriefingQuestionProps {
  briefingAvailableCandidateCount: number
  available: boolean
  questionInput: string
  questionResult: QuantAiCandidateBriefingQuestion | null
  questionLoading: boolean
  questionErrorMessage: string | null
  questionConfigurationError: boolean
}

export interface QuantAiCandidateBriefingHistoryProps {
  currentCandidateCodes: string[]
  currentScopeKey: string
  currentSnapshotId: string | null
  historyResetKey: number
  questionPromptReady: boolean
  briefingSessionId?: string
  questionSessionId?: string
  sessionHistory?: QuantAiCandidateBriefingSession[] | null
  sessionHistoryErrorMessage: string | null
}

export interface QuantAiCandidateBriefingContentProps {
  briefing: QuantAiCandidateBriefing
  questionPromptReady: boolean
}

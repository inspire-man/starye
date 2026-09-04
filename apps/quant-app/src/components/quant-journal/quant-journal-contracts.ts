import type { QuantDecisionRecord, QuantDecisionRecordAction, QuantResearchRun } from '../../lib/quant-view-models'

export interface QuantDecisionJournalCurrentProps {
  record: QuantDecisionRecord | null
  loading: boolean
  loadErrorMessage: string | null
}

export interface QuantDecisionJournalFormProps {
  run: QuantResearchRun | null
  record: QuantDecisionRecord | null
  saving: boolean
}

export interface QuantDecisionJournalHistoryProps {
  history: QuantDecisionRecord[]
  historyLoading: boolean
  historyErrorMessage: string | null
}

export interface QuantDecisionJournalSaveInput {
  action: QuantDecisionRecordAction
  note: string | null
}

import type { QuantAiFactorImpact, QuantAiFactorReview, QuantResearchFactor } from '../../lib/quant-view-models'

export interface QuantAiSummaryFactorRow {
  readonly key: string
  readonly label: string
  readonly factor: QuantResearchFactor | null
  readonly review: QuantAiFactorReview | null
  readonly impact: QuantAiFactorImpact['factors'][number] | null
}

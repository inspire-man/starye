import { quantCandidateApi } from '../api/resources/candidate'
import { quantConfigApi } from '../api/resources/config'
import { quantDecisionApi } from '../api/resources/decision'
import { quantMarketApi } from '../api/resources/market'
import { quantResearchApi } from '../api/resources/research'
import { quantWorkspaceApi } from '../api/resources/workspace'

export { QUANT_API_PREFIX, QuantApiError } from '../api/http-client'
export type { UpdateAiConfigInput } from '../api/resources/config'
export type { CreateQuantDecisionAssistantInput } from '../api/resources/decision'
export type { AddWatchlistInput, DailyBarQuery } from '../api/resources/workspace'

export const quantApi = {
  ...quantWorkspaceApi,
  ...quantConfigApi,
  ...quantResearchApi,
  ...quantDecisionApi,
  ...quantCandidateApi,
  ...quantMarketApi,
}

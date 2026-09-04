import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { QuantError } from '../../domain/quant/errors'
import { requireAuth } from '../../middleware/guard'
import { quantAiRoutes } from './handlers/ai.handler'
import { quantCandidateRoutes } from './handlers/candidates.handler'
import { quantConfigRoutes } from './handlers/config.handler'
import { quantDecisionRoutes } from './handlers/decision.handler'
import { quantMarketRoutes } from './handlers/market.handler'
import { quantResearchRoutes } from './handlers/research.handler'
import { quantWorkspaceRoutes } from './handlers/workspace.handler'

export const quantRoutes = new Hono<AppEnv>()

quantRoutes.use('*', requireAuth())

quantRoutes.onError((error, c) => {
  if (error instanceof QuantError) {
    return c.json({
      success: false as const,
      code: error.code,
      error: error.message,
      details: error.details ?? null,
    }, error.status)
  }
  throw error
})

quantRoutes.route('/', quantWorkspaceRoutes)
quantRoutes.route('/', quantCandidateRoutes)
quantRoutes.route('/', quantConfigRoutes)
quantRoutes.route('/', quantResearchRoutes)
quantRoutes.route('/', quantDecisionRoutes)
quantRoutes.route('/', quantAiRoutes)
quantRoutes.route('/', quantMarketRoutes)

export default quantRoutes

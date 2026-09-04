import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { readQuantCandidateWorkspace } from '../../../domain/quant/candidate-service'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId } from '../route-context'

export const quantCandidateRoutes = new Hono<AppEnv>()

quantCandidateRoutes.get('/candidates', quantRouteDocs('workspace.candidates.list'), async (c) => {
  const userId = currentQuantUserId(c)
  return c.json({ success: true as const, data: await readQuantCandidateWorkspace(c.get('db'), userId) })
})

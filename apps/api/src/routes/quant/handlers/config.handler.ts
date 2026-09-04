import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { deleteQuantAiConfig, getDecryptedQuantAiConfig, getQuantAiConfig, saveQuantAiConfig } from '../../../domain/quant/ai-config'
import { testQuantAiConnection } from '../../../domain/quant/ai-connection'
import { createQuantCapabilityRegistryFromEnv } from '../../../domain/quant/capabilities'
import { QuantError } from '../../../domain/quant/errors'
import { getQuantInvestmentKnowledge } from '../../../domain/quant/investment-knowledge'
import { deleteQuantFactorConfiguration, getQuantFactorConfiguration, saveQuantFactorConfiguration } from '../../../domain/quant/repository'
import { QuantAiConfigUpdateSchema, QuantFactorConfigUpdateSchema } from '../../../schemas/quant'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId } from '../route-context'

export const quantConfigRoutes = new Hono<AppEnv>()

quantConfigRoutes.get('/capabilities', quantRouteDocs('config.capabilities.get'), (c) => {
  const registry = createQuantCapabilityRegistryFromEnv(c.env)
  return c.json({
    success: true as const,
    data: {
      tier: registry.tier,
      provider: registry.provider,
      enabled: registry.enabled,
      capabilities: registry.capabilities,
    },
  })
})

quantConfigRoutes.get('/knowledge', quantRouteDocs('config.knowledge.get'), (c) => {
  return c.json({
    success: true as const,
    data: getQuantInvestmentKnowledge(),
  })
})

quantConfigRoutes.get('/ai-config', quantRouteDocs('config.ai.get'), async (c) => {
  const data = await getQuantAiConfig(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data })
})

quantConfigRoutes.get('/factor-config', quantRouteDocs('config.factor.get'), async (c) => {
  const data = await getQuantFactorConfiguration(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data })
})

quantConfigRoutes.put('/factor-config', quantRouteDocs('config.factor.update'), validator('json', QuantFactorConfigUpdateSchema), async (c) => {
  const input = c.req.valid('json')
  const data = await saveQuantFactorConfiguration(c.get('db'), {
    userId: currentQuantUserId(c),
    weights: input.weights,
  })
  return c.json({ success: true as const, data })
})

quantConfigRoutes.delete('/factor-config', quantRouteDocs('config.factor.delete'), async (c) => {
  const data = await deleteQuantFactorConfiguration(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data })
})

quantConfigRoutes.put('/ai-config', quantRouteDocs('config.ai.update'), validator('json', QuantAiConfigUpdateSchema), async (c) => {
  const input = c.req.valid('json')
  const data = await saveQuantAiConfig(c.get('db'), {
    userId: currentQuantUserId(c),
    provider: input.provider,
    model: input.model,
    baseUrl: input.base_url,
    apiKey: input.api_key,
    clearApiKey: input.clear_api_key,
    responseMode: input.response_mode,
    generationTimeoutMs: input.generation_timeout_ms,
  }, c.env.QUANT_AI_ENCRYPTION_KEY)
  return c.json({ success: true as const, data })
})

quantConfigRoutes.post('/ai-config/test', quantRouteDocs('config.ai.test'), async (c) => {
  const userId = currentQuantUserId(c)
  const config = await getDecryptedQuantAiConfig(c.get('db'), userId, c.env.QUANT_AI_ENCRYPTION_KEY)
  if (!config)
    throw new QuantError('QUANT_AI_SUMMARY_CONFIGURATION', 'AI summary configuration is not available', 503)
  const data = await testQuantAiConnection({
    config,
  })
  return c.json({ success: true as const, data })
})

quantConfigRoutes.delete('/ai-config', quantRouteDocs('config.ai.delete'), async (c) => {
  const deleted = await deleteQuantAiConfig(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data: { deleted } })
})

import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { buildQuantValuationComparison } from '../../../domain/quant/comparison'
import { QuantError } from '../../../domain/quant/errors'
import { buildQuantFinancialQualityComparison } from '../../../domain/quant/financial-comparison'
import { createEastmoneyFinancialProvider, createEastmoneyValuationProvider, mapQuantProviderError } from '../../../domain/quant/provider'
import { ensureQuantStarterWatchlist, listQuantWatchlist, normalizeTsCode } from '../../../domain/quant/repository'
import { readQuantShareholderReturns } from '../../../domain/quant/shareholder-return'
import { readQuantValueSelection } from '../../../domain/quant/value-selection-service'
import { QuantFinancialHistoryQuerySchema, QuantWatchlistParamSchema } from '../../../schemas/quant'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId, eastmoneyProviderOptions } from '../route-context'
import { capitalStructureProvider, cashflowProvider, dividendProvider, repurchaseProvider } from './market-support'

export const quantMarketRoutes = new Hono<AppEnv>()

quantMarketRoutes.get('/valuation/:tsCode', quantRouteDocs('market.valuation.get'), validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const provider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
    const data = await provider.fetchValuation({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantMarketRoutes.get('/valuation/compare/:tsCode', quantRouteDocs('market.valuation.compare'), validator('param', QuantWatchlistParamSchema), async (c) => {
  const tsCode = normalizeTsCode(c.req.valid('param').tsCode)
  const watchlist = await listQuantWatchlist(c.get('db'), currentQuantUserId(c))
  if (!watchlist.some(item => item.tsCode === tsCode))
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const provider = createEastmoneyValuationProvider(eastmoneyProviderOptions(c.env))
  try {
    const samples = await Promise.all(watchlist.map(async (item) => {
      try {
        return {
          tsCode: item.tsCode,
          name: item.name,
          valuation: await provider.fetchValuation({ tsCode: item.tsCode }),
        }
      }
      catch (error) {
        if (item.tsCode === tsCode)
          throw error
        return { tsCode: item.tsCode, name: item.name, valuation: null }
      }
    }))
    const data = buildQuantValuationComparison(tsCode, samples)
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantMarketRoutes.get('/financial/:tsCode', quantRouteDocs('market.financial.get'), validator('param', QuantWatchlistParamSchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  try {
    const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
    const data = await provider.fetchFinancialQuality({ tsCode })
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantMarketRoutes.get('/financial/history/:tsCode', quantRouteDocs('market.financial.history'), validator('param', QuantWatchlistParamSchema), validator('query', QuantFinancialHistoryQuerySchema), async (c) => {
  const { tsCode } = c.req.valid('param')
  const input = c.req.valid('query')
  try {
    const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
    const reports = await provider.fetchFinancialQualityHistory({
      tsCode,
      ...(input.limit ? { limit: Number(input.limit) } : {}),
    })
    return c.json({
      success: true as const,
      data: {
        tsCode: reports[0]?.tsCode ?? tsCode.toUpperCase(),
        observedAt: reports[0]?.observedAt ?? new Date().toISOString(),
        reports,
      },
    })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantMarketRoutes.get('/financial/compare/:tsCode', quantRouteDocs('market.financial.compare'), validator('param', QuantWatchlistParamSchema), async (c) => {
  const tsCode = normalizeTsCode(c.req.valid('param').tsCode)
  const watchlist = await listQuantWatchlist(c.get('db'), currentQuantUserId(c))
  if (!watchlist.some(item => item.tsCode === tsCode))
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const provider = createEastmoneyFinancialProvider(eastmoneyProviderOptions(c.env))
  try {
    const samples = await Promise.all(watchlist.map(async (item) => {
      try {
        return {
          tsCode: item.tsCode,
          name: item.name,
          quality: await provider.fetchFinancialQuality({ tsCode: item.tsCode }),
        }
      }
      catch (error) {
        if (item.tsCode === tsCode)
          throw error
        return { tsCode: item.tsCode, name: item.name, quality: null }
      }
    }))
    const data = buildQuantFinancialQualityComparison(tsCode, samples)
    return c.json({ success: true as const, data })
  }
  catch (error) {
    throw mapQuantProviderError(error)
  }
})

quantMarketRoutes.get('/value-selection', quantRouteDocs('market.valueSelection.get'), async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const options = eastmoneyProviderOptions(c.env)
  const data = await readQuantValueSelection(c.get('db'), userId, {
    valuation: createEastmoneyValuationProvider(options),
    financial: createEastmoneyFinancialProvider(options),
  })
  return c.json({ success: true as const, data })
})

quantMarketRoutes.get('/shareholder-returns', quantRouteDocs('market.shareholderReturns.get'), async (c) => {
  const userId = currentQuantUserId(c)
  await ensureQuantStarterWatchlist(c.get('db'), userId)
  const data = await readQuantShareholderReturns(
    c.get('db'),
    userId,
    dividendProvider(c.env),
    cashflowProvider(c.env),
    capitalStructureProvider(c.env),
    repurchaseProvider(c.env),
  )
  return c.json({ success: true as const, data })
})

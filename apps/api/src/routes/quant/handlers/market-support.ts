import type { Database } from '@starye/db'
import type { QuantDecisionAssistantMarketInput } from '../../../domain/quant/decision-assistant'
import type { AppEnv } from '../../../types'
import { createQuantAkshareBridge, createQuantAkshareCashflowProvider, createQuantAkshareFinancialProvider, createQuantAkshareRepurchaseProvider } from '../../../domain/quant/akshare-bridge'
import { QuantError } from '../../../domain/quant/errors'
import { createEastmoneyCapitalStructureProvider, createEastmoneyCashflowProvider, createEastmoneyDividendProvider, createEastmoneyFinancialProvider, createEastmoneyMarketQuoteProvider, createEastmoneyRepurchaseProvider, createQuantCashflowProviderChain, createQuantDividendProviderChain, createQuantFinancialProviderChain, createQuantRepurchaseProviderChain, createTushareCashflowProvider, createTushareDividendProvider, createTushareFinancialProvider, mapQuantProviderError, resolveQuantProviderName } from '../../../domain/quant/provider'
import { getLatestQuantDailyBar } from '../../../domain/quant/repository'
import { eastmoneyProviderOptions, tushareProviderOptions } from '../route-context'

function akshareBridge(env?: AppEnv['Bindings']) {
  const timeoutMs = Number(env?.QUANT_AKSHARE_BRIDGE_TIMEOUT_MS)
  return createQuantAkshareBridge({
    baseUrl: env?.QUANT_AKSHARE_BRIDGE_URL,
    token: env?.QUANT_AKSHARE_BRIDGE_TOKEN,
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  })
}

export async function resolveDecisionAssistantMarket(env: AppEnv['Bindings'] | undefined, db: Database, tsCode: string): Promise<{ readonly latestDailyBar: Awaited<ReturnType<typeof getLatestQuantDailyBar>>, readonly market: QuantDecisionAssistantMarketInput }> {
  const quoteBaseUrl = env?.EASTMONEY_QUOTE_BASE_URL?.trim() || 'https://push2.eastmoney.com'
  const [dailyResult, quoteResult] = await Promise.allSettled([
    getLatestQuantDailyBar(db, tsCode),
    createEastmoneyMarketQuoteProvider({ ...eastmoneyProviderOptions(env), baseUrl: quoteBaseUrl }).fetchMarketQuote({ tsCode }),
  ])
  if (dailyResult.status === 'rejected')
    throw dailyResult.reason

  if (quoteResult.status === 'fulfilled' && isCurrentMarketDate(quoteResult.value.observedAt)) {
    return {
      latestDailyBar: dailyResult.value,
      market: {
        currentPrice: quoteResult.value.price,
        currentPriceSource: 'eastmoney-realtime',
        currentPriceStatus: 'realtime',
        currentPriceObservedAt: quoteResult.value.observedAt,
        currentPriceChangePercent: quoteResult.value.changePercent,
        quoteErrorCode: null,
      },
    }
  }

  const quoteError = quoteResult.status === 'rejected' ? mapQuantProviderError(quoteResult.reason) : null
  const quoteFallbackCode = quoteError?.code ?? 'QUANT_MARKET_QUOTE_STALE'
  if (dailyResult.value && Number.isFinite(dailyResult.value.close) && dailyResult.value.close > 0) {
    return {
      latestDailyBar: dailyResult.value,
      market: {
        currentPrice: dailyResult.value.close,
        currentPriceSource: 'local-daily-bars',
        currentPriceStatus: 'latest-close',
        currentPriceObservedAt: dailyResult.value.tradeDate,
        currentPriceChangePercent: null,
        quoteErrorCode: quoteFallbackCode,
      },
    }
  }

  throw new QuantError('QUANT_DECISION_ASSISTANT_MARKET_UNAVAILABLE', 'Automatic market price is unavailable and no local latest close exists', 503, {
    provider: 'eastmoney',
    errorCode: quoteFallbackCode,
  })
}

function isCurrentMarketDate(observedAt: string, now = new Date()): boolean {
  const observed = new Date(observedAt)
  if (Number.isNaN(observed.getTime()) || observed.getTime() > now.getTime() + 5 * 60 * 1_000)
    return false
  const dateKey = (value: Date): string => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
    const year = parts.find(part => part.type === 'year')?.value ?? ''
    const month = parts.find(part => part.type === 'month')?.value ?? ''
    const day = parts.find(part => part.type === 'day')?.value ?? ''
    return `${year}-${month}-${day}`
  }
  return dateKey(observed) === dateKey(now)
}

export function dividendProvider(env?: AppEnv['Bindings']) {
  const tushare = createTushareDividendProvider(tushareProviderOptions(env))
  const eastmoney = createEastmoneyDividendProvider(eastmoneyProviderOptions(env))
  const selected = resolveQuantProviderName(env)
  const primary = selected === 'tushare' && tushare.isConfigured ? tushare : eastmoney
  const fallback = primary.name === 'tushare' && eastmoney.isConfigured
    ? eastmoney
    : primary.name === 'eastmoney' && tushare.isConfigured
      ? tushare
      : undefined
  return createQuantDividendProviderChain(primary, fallback)
}

export function cashflowProvider(env?: AppEnv['Bindings']) {
  const tushare = createTushareCashflowProvider(tushareProviderOptions(env))
  const eastmoney = createEastmoneyCashflowProvider(eastmoneyProviderOptions(env))
  const explicitlySelected = env?.QUANT_DATA_PROVIDER?.trim().toLowerCase()
  const primary = explicitlySelected === 'tushare' && tushare.isConfigured ? tushare : eastmoney
  const fallback = primary.name === 'tushare' && eastmoney.isConfigured
    ? eastmoney
    : primary.name === 'eastmoney' && tushare.isConfigured
      ? tushare
      : undefined
  const primaryChain = createQuantCashflowProviderChain(primary, fallback)
  return createQuantCashflowProviderChain(primaryChain, createQuantAkshareCashflowProvider(akshareBridge(env)))
}

export function financialProvider(env?: AppEnv['Bindings']) {
  const tushare = createTushareFinancialProvider(tushareProviderOptions(env))
  const eastmoney = createEastmoneyFinancialProvider(eastmoneyProviderOptions(env))
  const explicitlySelected = env?.QUANT_DATA_PROVIDER?.trim().toLowerCase()
  const primary = explicitlySelected === 'tushare' && tushare.isConfigured ? tushare : eastmoney
  const fallback = primary.name === 'tushare' && eastmoney.isConfigured
    ? eastmoney
    : primary.name === 'eastmoney' && tushare.isConfigured
      ? tushare
      : undefined
  const primaryChain = createQuantFinancialProviderChain(primary, fallback)
  return createQuantFinancialProviderChain(primaryChain, createQuantAkshareFinancialProvider(akshareBridge(env)))
}

export function capitalStructureProvider(env?: AppEnv['Bindings']) {
  return createEastmoneyCapitalStructureProvider(eastmoneyProviderOptions(env))
}

export function repurchaseProvider(env?: AppEnv['Bindings']) {
  const baseUrl = env?.EASTMONEY_REPURCHASE_BASE_URL?.trim()
  const eastmoney = createEastmoneyRepurchaseProvider({
    ...eastmoneyProviderOptions(env),
    ...(baseUrl ? { repurchaseBaseUrl: baseUrl } : {}),
  })
  return createQuantRepurchaseProviderChain(eastmoney, createQuantAkshareRepurchaseProvider(akshareBridge(env)))
}

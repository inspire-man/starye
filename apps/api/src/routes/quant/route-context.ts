import type { Context } from 'hono'
import type { EastmoneyProviderOptions, TushareProviderOptions } from '../../domain/quant/provider'
import type { AppEnv } from '../../types'
import { QuantError } from '../../domain/quant/errors'
import { createEastmoneyStockBasicProvider, createTushareStockBasicProvider, resolveQuantProviderName } from '../../domain/quant/provider'

export function currentQuantUserId(c: Context<AppEnv>): string {
  const userId = c.get('user')?.id
  if (!userId)
    throw new QuantError('QUANT_INVALID_INPUT', 'Authenticated user is required', 401)
  return userId
}

export function eastmoneyProviderOptions(env?: AppEnv['Bindings']): EastmoneyProviderOptions {
  const baseUrl = env?.EASTMONEY_BASE_URL?.trim()
  const dividendBaseUrl = env?.EASTMONEY_DIVIDEND_BASE_URL?.trim()
  const timeoutMs = Number(env?.EASTMONEY_TIMEOUT_MS)
  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(dividendBaseUrl ? { dividendBaseUrl } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

export function tushareProviderOptions(env?: AppEnv['Bindings']): TushareProviderOptions {
  const token = env?.TUSHARE_TOKEN?.trim()
  const baseUrl = env?.TUSHARE_BASE_URL?.trim()
  const timeoutMs = Number(env?.TUSHARE_TIMEOUT_MS)
  return {
    ...(token ? { token } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

export function stockBasicProvider(env?: AppEnv['Bindings']) {
  const options = tushareProviderOptions(env)
  return resolveQuantProviderName(env) === 'tushare'
    ? createTushareStockBasicProvider(options)
    : createEastmoneyStockBasicProvider(eastmoneyProviderOptions(env))
}

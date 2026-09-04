import type {
  CapabilitiesResponse,
  CapabilityKey,
  QuantAiConfig,
  QuantAiConnectionTest,
  QuantAiProvider,
  QuantAiResponseMode,
  QuantFactorConfiguration,
  QuantFactorFreshness,
  QuantFactorWeights,
  QuantInvestmentKnowledge,
  QuantKnowledgeAlias,
  QuantKnowledgeFactor,
  QuantKnowledgeSource,
  QuantProviderName,
} from '../../lib/quant-view-models'
import type { QuantRequestOptions } from '../http-client'
import type { UpdateAiConfigRequestDto, UpdateFactorConfigurationRequestDto } from '../quant-dtos'
import { CAPABILITY_ORDER } from '../../lib/quant-view-models'
import { QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readBoolean, readNumber, readString, readStringList } from '../payload'

export interface UpdateAiConfigInput {
  provider: QuantAiProvider
  model: string
  baseUrl?: string | null
  responseMode?: QuantAiResponseMode
  generationTimeoutMs?: number
  apiKey?: string
  clearApiKey?: boolean
}

function unknownFactorFreshness(): QuantFactorFreshness {
  return {
    version: 'unknown',
    status: 'unknown',
    observedAt: null,
    ageDays: null,
    freshWithinDays: 0,
    agingWithinDays: 0,
    detail: '历史响应未记录因子新鲜度',
    missingEvidenceKeys: [],
    unverifiableEvidenceKeys: [],
  }
}

export function parseFactorFreshness(value: unknown): QuantFactorFreshness | null {
  if (value === undefined || value === null)
    return unknownFactorFreshness()
  if (!isRecord(value))
    return null
  const version = readString(value, 'version')
  const status = readString(value, 'status')
  const observedAt = value.observedAt === null ? null : readString(value, 'observedAt', 'observed_at')
  const ageDays = value.ageDays === null ? null : readNumber(value, 'ageDays', 'age_days')
  const freshWithinDays = readNumber(value, 'freshWithinDays', 'fresh_within_days')
  const agingWithinDays = readNumber(value, 'agingWithinDays', 'aging_within_days')
  const detail = readString(value, 'detail')
  if (!version || (status !== 'fresh' && status !== 'aging' && status !== 'stale' && status !== 'unknown')
    || (value.observedAt !== null && !observedAt) || (value.ageDays !== null && ageDays === null)
    || freshWithinDays === null || freshWithinDays < 0 || agingWithinDays === null || agingWithinDays < freshWithinDays || !detail) {
    return null
  }
  return {
    version,
    status,
    observedAt,
    ageDays,
    freshWithinDays,
    agingWithinDays,
    detail,
    missingEvidenceKeys: readStringList(value, 'missingEvidenceKeys', 'missing_evidence_keys'),
    unverifiableEvidenceKeys: readStringList(value, 'unverifiableEvidenceKeys', 'unverifiable_evidence_keys'),
  }
}

function capabilityLabel(key: CapabilityKey): string {
  const labels: Record<CapabilityKey, string> = {
    daily: '日线 daily',
    stock_basic: '股票基础 stock_basic',
    trade_cal: '交易日历 trade_cal',
    daily_basic: '估值基础 daily_basic',
  }
  return labels[key]
}

function defaultCapabilityReason(key: CapabilityKey, tier: number | null): string {
  if (key === 'daily' && tier !== null)
    return '当前 v1 日线能力已开放'
  if (tier === null)
    return `当前积分档位未配置，${key} 未启用`
  return `当前积分档位 ${tier} 仅开放 daily，${key} 仍未启用`
}

function capabilityReason(key: CapabilityKey, tier: number | null, value: string | null): string {
  if (value === 'enabled')
    return key === 'daily' ? '当前 v1 日线能力已开放' : '当前能力已开放'
  if (value === 'requires_points_tier_2000')
    return `需要 2000 积分，当前 ${tier ?? '未知'} 积分档位未启用`
  if (value === 'invalid_points_tier')
    return '积分档位配置无效，能力已关闭'
  if (value === 'invalid_provider')
    return '数据源配置无效，能力已关闭'
  return value || defaultCapabilityReason(key, tier)
}

function findCapability(raw: unknown, key: CapabilityKey): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    const item = raw.find((value) => {
      if (!isRecord(value))
        return false
      return readString(value, 'key', 'name', 'capability', 'apiName', 'api_name') === key
    })
    return isRecord(item) ? item : null
  }
  if (isRecord(raw) && isRecord(raw[key]))
    return raw[key]
  return null
}

export function parseCapabilities(payload: unknown): CapabilitiesResponse {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const tier = readNumber(record, 'tier', 'pointsTier', 'points_tier')
  const providerValue = readString(record, 'provider', 'dataProvider', 'data_provider')
  const provider: QuantProviderName | null = providerValue === 'tushare' || providerValue === 'eastmoney' ? providerValue : null
  const enabledValues = Array.isArray(record.enabled) ? record.enabled : []
  const enabled = CAPABILITY_ORDER.filter(key => enabledValues.includes(key))
  const rawCapabilities = record.capabilities
  const capabilities = CAPABILITY_ORDER.map((key) => {
    const item = findCapability(rawCapabilities, key)
    const itemEnabled = item ? readBoolean(item, 'enabled', 'available') : null
    const isEnabled = itemEnabled ?? enabled.includes(key)
    if (isEnabled && !enabled.includes(key))
      enabled.push(key)
    return {
      key,
      label: capabilityLabel(key),
      enabled: isEnabled,
      reason: capabilityReason(key, tier, readString(item ?? {}, 'reason', 'disabledReason', 'disabled_reason')),
      requires: item && Array.isArray(item.requires) ? item.requires.filter((value): value is string => typeof value === 'string') : undefined,
    }
  })
  return { tier, provider, enabled, capabilities }
}

export function parseAiConfig(payload: unknown): QuantAiConfig | null {
  const data = unwrapData(payload)
  if (data === null)
    return null
  if (!isRecord(data))
    throw new QuantApiError('AI 配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const provider = readString(data, 'provider')
  if (provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama')
    throw new QuantApiError('AI provider 数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const id = readString(data, 'id')
  const model = readString(data, 'model')
  if (!id || !model)
    throw new QuantApiError('AI 配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const responseMode = readString(data, 'responseMode', 'response_mode') || 'stream'
  const generationTimeoutMs = readNumber(data, 'generationTimeoutMs', 'generation_timeout_ms') ?? 300000
  if ((responseMode !== 'stream' && responseMode !== 'json') || !Number.isInteger(generationTimeoutMs) || generationTimeoutMs < 300000 || generationTimeoutMs > 600000)
    throw new QuantApiError('AI 运行参数数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return {
    id,
    provider,
    model,
    baseUrl: readString(data, 'baseUrl', 'base_url'),
    responseMode,
    generationTimeoutMs,
    hasApiKey: data.hasApiKey === true || data.has_api_key === true,
    apiKeyHint: readString(data, 'apiKeyHint', 'api_key_hint'),
    createdAt: readString(data, 'createdAt', 'created_at'),
    updatedAt: readString(data, 'updatedAt', 'updated_at'),
  }
}

export function parseFactorConfiguration(payload: unknown): QuantFactorConfiguration {
  const data = unwrapData(payload)
  if (!isRecord(data))
    throw new QuantApiError('因子配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  const version = readString(data, 'version')
  const source = readString(data, 'source')
  const weights = isRecord(data.weights) ? data.weights : null
  const trend = weights ? readNumber(weights, 'trend') : null
  const valuation = weights ? readNumber(weights, 'valuation') : null
  const quality = weights ? readNumber(weights, 'quality') : null
  const shareholderReturn = weights ? readNumber(weights, 'shareholder-return') : null
  const risk = weights ? readNumber(weights, 'risk') : null
  const values = [trend, valuation, quality, shareholderReturn, risk]
  const total = values.every(value => value !== null) ? values.reduce((sum, value) => sum + value!, 0) : null
  if (!version || (source !== 'default' && source !== 'user') || values.some(value => value === null || value < 0 || value > 1) || total === null || Math.abs(total - 1) > 0.0001)
    throw new QuantApiError('因子配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return {
    version,
    weights: { 'trend': trend!, 'valuation': valuation!, 'quality': quality!, 'shareholder-return': shareholderReturn!, 'risk': risk! },
    source,
    updatedAt: readString(data, 'updatedAt', 'updated_at'),
  }
}

export function parseAiConnectionTest(payload: unknown): QuantAiConnectionTest {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  const provider = readString(record, 'provider')
  const model = readString(record, 'model')
  const testedAt = readString(record, 'testedAt', 'tested_at')
  const latencyMs = readNumber(record, 'latencyMs', 'latency_ms')
  if ((provider !== 'openai_compatible' && provider !== 'deepseek' && provider !== 'qwen' && provider !== 'gemini' && provider !== 'ollama') || !model || !testedAt || latencyMs === null || latencyMs < 0)
    throw new QuantApiError('AI 连接测试数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
  return { provider, model, testedAt, latencyMs }
}

function parseKnowledgeSource(value: unknown): QuantKnowledgeSource | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const title = readString(value, 'title')
  const url = readString(value, 'url')
  if (!id || !title || !url)
    return null
  return {
    id,
    title,
    url,
    publishedAt: readString(value, 'publishedAt', 'published_at'),
    access: value.access === 'preview' ? 'preview' : 'full',
    summary: readString(value, 'summary') || '',
  }
}

function parseKnowledgeFactor(value: unknown): QuantKnowledgeFactor | null {
  if (!isRecord(value))
    return null
  const id = readString(value, 'id')
  const category = readString(value, 'category')
  const title = readString(value, 'title')
  if (!id || !category || !title)
    return null
  const currentDimension = readString(value, 'currentDimension', 'current_dimension')
  const status = readString(value, 'status')
  return {
    id,
    category,
    title,
    interpretation: readString(value, 'interpretation') || '',
    measurement: readString(value, 'measurement') || '',
    requiredFields: readStringList(value, 'requiredFields', 'required_fields'),
    availableFields: readStringList(value, 'availableFields', 'available_fields'),
    missingFields: readStringList(value, 'missingFields', 'missing_fields'),
    status: status === 'active' || status === 'partial' || status === 'planned' ? status : 'context',
    eligibleInValueQuality: value.eligibleInValueQuality === true || value.eligible_in_value_quality === true,
    currentDimension: currentDimension === 'valuation' || currentDimension === 'quality' || currentDimension === 'growth' || currentDimension === 'resilience' || currentDimension === 'trend' ? currentDimension : null,
    sourceIds: readStringList(value, 'sourceIds', 'source_ids'),
  }
}

function parseKnowledgeAlias(value: unknown): QuantKnowledgeAlias | null {
  if (!isRecord(value))
    return null
  const alias = readString(value, 'alias')
  if (!alias)
    return null
  const status = readString(value, 'status')
  const confidence = readString(value, 'confidence')
  return {
    alias,
    status: status === 'mapped' || status === 'ambiguous' ? status : 'context_only',
    confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'low',
    tsCode: readString(value, 'tsCode', 'ts_code'),
    name: readString(value, 'name'),
    candidates: readStringList(value, 'candidates'),
    note: readString(value, 'note') || '',
  }
}

export function parseInvestmentKnowledge(payload: unknown): QuantInvestmentKnowledge {
  const data = unwrapData(payload)
  const record = isRecord(data) ? data : {}
  return {
    version: readString(record, 'version') || 'investment-knowledge-v3',
    observedAt: readString(record, 'observedAt', 'observed_at') || '',
    sources: Array.isArray(record.sources)
      ? record.sources.flatMap((value) => {
          const item = parseKnowledgeSource(value)
          return item ? [item] : []
        })
      : [],
    factors: Array.isArray(record.factors)
      ? record.factors.flatMap((value) => {
          const item = parseKnowledgeFactor(value)
          return item ? [item] : []
        })
      : [],
    aliases: Array.isArray(record.aliases)
      ? record.aliases.flatMap((value) => {
          const item = parseKnowledgeAlias(value)
          return item ? [item] : []
        })
      : [],
    recommendedWatchlist: Array.isArray(record.recommendedWatchlist || record.recommended_watchlist)
      ? (Array.isArray(record.recommendedWatchlist) ? record.recommendedWatchlist : record.recommended_watchlist as unknown[]).flatMap((value) => {
          if (!isRecord(value))
            return []
          const tsCode = readString(value, 'tsCode', 'ts_code')
          const name = readString(value, 'name')
          return tsCode && name ? [{ tsCode, name }] : []
        })
      : [],
  }
}

export const quantConfigApi = {
  async getCapabilities(): Promise<CapabilitiesResponse> {
    return parseCapabilities(await requestJson('/capabilities'))
  },

  async getInvestmentKnowledge(options: QuantRequestOptions = {}): Promise<QuantInvestmentKnowledge> {
    return parseInvestmentKnowledge(await requestJson('/knowledge', options.signal ? { signal: options.signal } : undefined))
  },

  async getAiConfig(): Promise<QuantAiConfig | null> {
    return parseAiConfig(await requestJson('/ai-config'))
  },

  async getFactorConfiguration(): Promise<QuantFactorConfiguration> {
    return parseFactorConfiguration(await requestJson('/factor-config'))
  },

  async updateFactorConfiguration(weights: QuantFactorWeights): Promise<QuantFactorConfiguration> {
    const body: UpdateFactorConfigurationRequestDto = { weights }
    return parseFactorConfiguration(await requestJson('/factor-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }))
  },

  async resetFactorConfiguration(): Promise<QuantFactorConfiguration> {
    return parseFactorConfiguration(await requestJson('/factor-config', { method: 'DELETE' }))
  },

  async updateAiConfig(input: UpdateAiConfigInput): Promise<QuantAiConfig> {
    const body: UpdateAiConfigRequestDto = {
      provider: input.provider,
      model: input.model,
      base_url: input.baseUrl,
      ...(input.responseMode !== undefined ? { response_mode: input.responseMode } : {}),
      ...(input.generationTimeoutMs !== undefined ? { generation_timeout_ms: input.generationTimeoutMs } : {}),
      api_key: input.apiKey,
      clear_api_key: input.clearApiKey,
    }
    const config = parseAiConfig(await requestJson('/ai-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }))
    if (!config)
      throw new QuantApiError('AI 配置数据格式无效', 502, 'QUANT_PROVIDER_INVALID_RESPONSE')
    return config
  },

  async testAiConfig(): Promise<QuantAiConnectionTest> {
    return parseAiConnectionTest(await requestJson('/ai-config/test', { method: 'POST' }))
  },

  async deleteAiConfig(): Promise<boolean> {
    const data = unwrapData(await requestJson('/ai-config', { method: 'DELETE' }))
    return isRecord(data) && data.deleted === true
  },
}

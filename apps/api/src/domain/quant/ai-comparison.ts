import type { QuantDecryptedAiConfig } from './ai-config'
import type { QuantResearchReport } from './research-report'
import { resolveQuantAiGenerationTimeout } from './ai-timeout'
import { requestQuantAiCompletion } from './ai-transport'
import { QuantError } from './errors'

export const QUANT_AI_COMPARISON_VERSION = 'research-comparison-v1' as const
export const QUANT_AI_COMPARISON_MAX_PROMPT_LENGTH = 24_000
export const QUANT_AI_COMPARISON_MAX_RESPONSE_LENGTH = 12_000
const QUANT_AI_COMPARISON_INSTRUCTION = [
  '请比较下面 2 至 3 份 Quant 确定性研究报告，只使用报告中已有的事实和 evidence key。',
  '返回一个 JSON 对象，字段必须是 overview、commonGround、differences、risks、nextChecks、citedEvidence。overview 是 1-3 句；commonGround、risks、nextChecks 各最多 6 项。',
  'differences 最多 6 项，每项必须是 {"tsCode":"报告中的股票代码","point":"可核对的差异","evidenceKeys":["同一股票报告中的 evidence key"]}。citedEvidence 最多 24 项，每项必须是 {"tsCode":"股票代码","evidenceKey":"该股票报告中的 evidence key"}。',
  '不要重算或修改报告中的 status、action、score；不要添加不存在的数值、来源、日期或证据。报告期不同或 provider 不同只能作为人工交叉核对线索。',
  '只描述研究事实、限制和核对路径，不给出买入、卖出、做多、做空、目标价、止损价或收益预测。',
].join('\n')

export interface QuantAiComparisonDifference {
  readonly tsCode: string
  readonly point: string
  readonly evidenceKeys: readonly string[]
}

export interface QuantAiComparisonCitation {
  readonly tsCode: string
  readonly evidenceKey: string
}

export interface QuantAiComparison {
  readonly comparisonVersion: typeof QUANT_AI_COMPARISON_VERSION
  readonly overview: string
  readonly commonGround: readonly string[]
  readonly differences: readonly QuantAiComparisonDifference[]
  readonly risks: readonly string[]
  readonly nextChecks: readonly string[]
  readonly citedEvidence: readonly QuantAiComparisonCitation[]
}

export interface QuantAiComparisonResult {
  readonly comparisonVersion: typeof QUANT_AI_COMPARISON_VERSION
  readonly provider: QuantDecryptedAiConfig['provider']
  readonly model: string
  readonly generatedAt: string
  readonly overview: string
  readonly commonGround: readonly string[]
  readonly differences: readonly QuantAiComparisonDifference[]
  readonly risks: readonly string[]
  readonly nextChecks: readonly string[]
  readonly citedEvidence: readonly QuantAiComparisonCitation[]
}

export interface QuantAiComparisonReport {
  readonly runId: string
  readonly report: QuantResearchReport
}

export interface QuantAiComparisonRequest {
  readonly reports: readonly QuantAiComparisonReport[]
  readonly config: QuantDecryptedAiConfig
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

const PROHIBITED_TRADING_LANGUAGE = /买入|卖出|做多|做空|目标价|价格目标|止损价|止盈|止损|涨到|跌到|收益预测|price[-\s]*target|target[-\s]*price|return[-\s]+forecast|\bbuy\b|\bsell\b/iu

function comparisonError(
  code: 'QUANT_AI_COMPARISON_CONFIGURATION' | 'QUANT_AI_COMPARISON_TIMEOUT' | 'QUANT_AI_COMPARISON_UPSTREAM' | 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
  message: string,
  status: 502 | 503 | 504,
): QuantError {
  return new QuantError(code, message, status)
}

function boundedText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`
}

function reportPrompt({ report }: QuantAiComparisonReport, evidenceLimit = 32, detailLength = 360): Record<string, unknown> {
  return {
    reportVersion: boundedText(report.reportVersion, 40),
    tsCode: boundedText(report.tsCode, 20),
    name: report.name ? boundedText(report.name, 120) : null,
    generatedAt: boundedText(report.generatedAt, 80),
    status: boundedText(report.status, 40),
    action: boundedText(report.action, 40),
    score: report.score,
    headline: boundedText(report.headline, 480),
    factorModel: report.factorModel
      ? {
          modelVersion: boundedText(report.factorModel.modelVersion, 80),
          score: report.factorModel.score,
          coverage: report.factorModel.coverage,
          configuration: report.factorModel.configuration ?? null,
          factors: report.factorModel.factors.slice(0, 8).map(factor => ({
            key: factor.key,
            label: boundedText(factor.label, 80),
            weight: factor.weight,
            status: factor.status,
            score: factor.score,
          })),
        }
      : null,
    decision: report.decision
      ? {
          recommendation: report.decision.recommendation,
          deterministicScore: report.decision.deterministicScore,
          coverage: report.decision.coverage,
          headline: boundedText(report.decision.headline, 480),
        }
      : null,
    evidence: report.evidence.slice(0, evidenceLimit).map(item => ({
      key: boundedText(item.key, 80),
      dimension: boundedText(item.dimension, 80),
      label: boundedText(item.label, 160),
      status: boundedText(item.status, 40),
      value: item.value,
      threshold: boundedText(item.threshold, 180),
      source: boundedText(item.source, 180),
      observedAt: item.observedAt,
      formulaVersion: boundedText(item.formulaVersion, 120),
      optional: item.optional === true,
      detail: boundedText(item.detail, detailLength),
    })),
  }
}

export function buildQuantAiComparisonPrompt(reports: readonly QuantAiComparisonReport[]): string {
  const payloadCandidates = [
    JSON.stringify(reports.slice(0, 3).map(report => reportPrompt(report))),
    JSON.stringify(reports.slice(0, 3).map(report => reportPrompt(report, 16, 180))),
    JSON.stringify(reports.slice(0, 3).map(report => reportPrompt(report, 8, 120))),
    JSON.stringify(reports.slice(0, 3).map(report => reportPrompt(report, 4, 80))),
  ]
  const separator = '\n研究报告：'
  const maxPayloadLength = Math.max(1, QUANT_AI_COMPARISON_MAX_PROMPT_LENGTH - QUANT_AI_COMPARISON_INSTRUCTION.length - separator.length)
  const minimalPayload = JSON.stringify(reports.slice(0, 3).map(({ report }) => ({
    tsCode: boundedText(report.tsCode, 20),
    status: boundedText(report.status, 40),
    factorModel: report.factorModel
      ? {
          score: report.factorModel.score,
          coverage: report.factorModel.coverage,
          configuration: report.factorModel.configuration ?? null,
        }
      : null,
    decision: report.decision
      ? {
          recommendation: report.decision.recommendation,
          deterministicScore: report.decision.deterministicScore,
          coverage: report.decision.coverage,
        }
      : null,
    evidence: report.evidence.slice(0, 1).map(item => ({
      key: boundedText(item.key, 80),
      status: boundedText(item.status, 40),
      value: item.value,
    })),
  })))
  const payload = payloadCandidates.find(value => value.length <= maxPayloadLength) || minimalPayload
  return `${QUANT_AI_COMPARISON_INSTRUCTION}${separator}${payload}`
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('```'))
    return trimmed
  return trimmed.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '').trim()
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function invalid(message: string): never {
  throw comparisonError('QUANT_AI_COMPARISON_INVALID_RESPONSE', message, 502)
}

function assertKnownFields(value: Record<string, unknown>, fields: readonly string[], label: string): void {
  const allowed = new Set(fields)
  if (Object.keys(value).some(key => !allowed.has(key)))
    invalid(`AI comparison ${label} contains unknown fields`)
}

function stringValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    invalid(`AI comparison field ${field} is invalid`)
  return value.trim()
}

function stringList(value: unknown, field: string, maxItems = 6): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems)
    invalid(`AI comparison field ${field} is invalid`)
  return value.map(item => stringValue(item, field, 360))
}

function reportEvidenceMap(reports: readonly QuantAiComparisonReport[]): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(reports.map(({ report }) => [report.tsCode, new Set(report.evidence.map(item => item.key))]))
}

function parseEvidenceKeys(value: unknown, tsCode: string, allowed: ReadonlyMap<string, ReadonlySet<string>>): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16 || value.some(item => typeof item !== 'string'))
    invalid('AI comparison difference evidence references are invalid')
  const keys = [...new Set(value as string[])]
  const allowedKeys = allowed.get(tsCode)
  if (!allowedKeys || keys.some(key => !allowedKeys.has(key)))
    invalid('AI comparison cited an unknown evidence key')
  return keys
}

function validateCitations(value: unknown, allowed: ReadonlyMap<string, ReadonlySet<string>>): readonly QuantAiComparisonCitation[] {
  if (!Array.isArray(value) || value.length > 24)
    invalid('AI comparison citations are invalid')
  const citations = value.map((item) => {
    const parsed = record(item)
    if (!parsed)
      invalid('AI comparison citation is invalid')
    assertKnownFields(parsed, ['tsCode', 'evidenceKey'], 'citation')
    const tsCode = stringValue(parsed.tsCode, 'citedEvidence.tsCode', 20).toUpperCase()
    const evidenceKey = stringValue(parsed.evidenceKey, 'citedEvidence.evidenceKey', 80)
    if (!allowed.get(tsCode)?.has(evidenceKey))
      invalid('AI comparison cited an unknown evidence key')
    return { tsCode, evidenceKey }
  })
  return [...new Map(citations.map(item => [`${item.tsCode}:${item.evidenceKey}`, item])).values()]
}

function validateComparison(value: unknown, reports: readonly QuantAiComparisonReport[]): QuantAiComparison {
  const parsed = record(value)
  if (!parsed)
    invalid('AI comparison is not an object')
  const allowedFields = new Set(['overview', 'commonGround', 'differences', 'risks', 'nextChecks', 'citedEvidence'])
  if (Object.keys(parsed).some(key => !allowedFields.has(key)))
    invalid('AI comparison contains unknown fields')
  const allowed = reportEvidenceMap(reports)
  const overview = stringValue(parsed.overview, 'overview', 1_200)
  const commonGround = stringList(parsed.commonGround, 'commonGround')
  const risks = stringList(parsed.risks, 'risks')
  const nextChecks = stringList(parsed.nextChecks, 'nextChecks')
  if (!Array.isArray(parsed.differences) || parsed.differences.length > 6)
    invalid('AI comparison differences are invalid')
  const differences = parsed.differences.map((item) => {
    const difference = record(item)
    if (!difference)
      invalid('AI comparison difference is invalid')
    assertKnownFields(difference, ['tsCode', 'point', 'evidenceKeys'], 'difference')
    const tsCode = stringValue(difference.tsCode, 'differences.tsCode', 20).toUpperCase()
    const point = stringValue(difference.point, 'differences.point', 480)
    const evidenceKeys = parseEvidenceKeys(difference.evidenceKeys, tsCode, allowed)
    return { tsCode, point, evidenceKeys }
  })
  const citedEvidence = validateCitations(parsed.citedEvidence, allowed)
  const text = [overview, ...commonGround, ...differences.map(item => item.point), ...risks, ...nextChecks].join('\n')
  if (PROHIBITED_TRADING_LANGUAGE.test(text))
    invalid('AI comparison contains a prohibited trading conclusion')
  return {
    comparisonVersion: QUANT_AI_COMPARISON_VERSION,
    overview,
    commonGround,
    differences,
    risks,
    nextChecks,
    citedEvidence,
  }
}

export async function generateQuantAiComparison(input: QuantAiComparisonRequest): Promise<QuantAiComparisonResult> {
  const { reports, config } = input
  if (reports.length < 2 || reports.length > 3)
    throw comparisonError('QUANT_AI_COMPARISON_INVALID_RESPONSE', 'AI comparison requires 2 to 3 reports', 502)
  if (new Set(reports.map(item => item.runId)).size !== reports.length || new Set(reports.map(item => item.report.tsCode)).size !== reports.length)
    throw comparisonError('QUANT_AI_COMPARISON_INVALID_RESPONSE', 'AI comparison reports must be unique', 502)
  if (!config.apiKey && config.provider !== 'ollama')
    throw comparisonError('QUANT_AI_COMPARISON_CONFIGURATION', 'AI API key is not configured', 503)
  const timeoutMs = resolveQuantAiGenerationTimeout(input.timeoutMs)
  const { content } = await requestQuantAiCompletion({
    config,
    timeoutMs,
    fetchImpl: input.fetchImpl,
    maxCompletionTokens: 4_000,
    maxResponseLength: QUANT_AI_COMPARISON_MAX_RESPONSE_LENGTH,
    temperature: 0.2,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: '你是严格的证据比较器，只能比较给定研究报告，不得创造事实或交易指令。' },
      { role: 'user', content: buildQuantAiComparisonPrompt(reports) },
    ],
    errorCodes: {
      configuration: 'QUANT_AI_COMPARISON_CONFIGURATION',
      timeout: 'QUANT_AI_COMPARISON_TIMEOUT',
      upstream: 'QUANT_AI_COMPARISON_UPSTREAM',
      invalid_response: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
    },
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(content))
  }
  catch {
    throw comparisonError('QUANT_AI_COMPARISON_INVALID_RESPONSE', 'AI comparison content is not valid JSON', 502)
  }
  const comparison = validateComparison(parsed, reports)
  return {
    ...comparison,
    provider: config.provider,
    model: config.model,
    generatedAt: new Date().toISOString(),
  }
}

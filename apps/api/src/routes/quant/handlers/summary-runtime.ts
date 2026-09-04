import type { Database } from '@starye/db'
import type { QuantAiRunAudit as QuantAiRunAuditRecord, QuantResearchRun as QuantResearchRunRecord, QuantResearchSummary as QuantResearchSummaryRecord } from '@starye/db/schema'
import type { QuantAiResponseMode, QuantDecryptedAiConfig } from '../../../domain/quant/ai-config'
import type { QuantResearchReport } from '../../../domain/quant/research-report'
import type { AppEnv } from '../../../types'
import { buildQuantAiFactorImpact, generateQuantAiSummary } from '../../../domain/quant/ai-summary'
import { resolveQuantAiGenerationTimeout } from '../../../domain/quant/ai-timeout'
import { QuantAkshareBridgeError } from '../../../domain/quant/akshare-bridge'
import { QuantError } from '../../../domain/quant/errors'
import { createQuantAiRunAudit, createQuantResearchSummary } from '../../../domain/quant/repository'
import { researchSummaryView } from './presenters'

export function akshareBridgeOptions(env?: AppEnv['Bindings']) {
  const timeoutMs = Number(env?.QUANT_AKSHARE_BRIDGE_TIMEOUT_MS)
  return {
    baseUrl: env?.QUANT_AKSHARE_BRIDGE_URL,
    token: env?.QUANT_AKSHARE_BRIDGE_TOKEN,
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  }
}

export function akshareBridgeErrorCode(error: unknown): string {
  return error instanceof QuantAkshareBridgeError ? `BRIDGE_${error.code}` : 'BRIDGE_UPSTREAM'
}

export function aiGenerationTimeoutMs(env?: AppEnv['Bindings'], configuredTimeoutMs?: number): number | undefined {
  const timeoutMs = Number(env?.QUANT_AI_GENERATION_TIMEOUT_MS)
  const candidates = [configuredTimeoutMs, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined]
    .filter((value): value is number => value !== undefined)
  return candidates.length ? resolveQuantAiGenerationTimeout(Math.min(...candidates)) : undefined
}

export interface QuantAiSummaryGenerationInput {
  readonly db: Database
  readonly userId: string
  readonly run: QuantResearchRunRecord
  readonly report: QuantResearchReport
  readonly config: QuantDecryptedAiConfig
  readonly env?: AppEnv['Bindings']
  readonly onTextDelta?: (delta: string, receivedLength: number) => void
  readonly onFinishReason?: (finishReason: string | null) => void
  readonly signal?: AbortSignal
}

async function recordQuantAiRunAudit(input: {
  readonly db: Database
  readonly userId: string
  readonly runId: string
  readonly config: QuantDecryptedAiConfig
  readonly generationTimeoutMs: number
  readonly status: 'completed' | 'failed' | 'cancelled'
  readonly receivedChars: number
  readonly durationMs: number
  readonly finishReason: string | null
  readonly errorCode: string | null
  readonly errorMessage: string | null
  readonly startedAt: Date
  readonly completedAt: Date
  readonly summaryId?: string | null
}): Promise<QuantAiRunAuditRecord | null> {
  try {
    return await createQuantAiRunAudit(input.db, {
      userId: input.userId,
      researchRunId: input.runId,
      summaryId: input.summaryId,
      provider: input.config.provider,
      model: input.config.model,
      responseMode: input.config.responseMode ?? 'json',
      generationTimeoutMs: input.generationTimeoutMs,
      status: input.status,
      receivedChars: input.receivedChars,
      durationMs: input.durationMs,
      finishReason: input.finishReason,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    })
  }
  catch (error) {
    console.error('[Quant] AI run audit persistence failed', error)
    return null
  }
}

export async function generateAndPersistQuantAiSummary(input: QuantAiSummaryGenerationInput): Promise<{ readonly summary: QuantResearchSummaryRecord, readonly audit: QuantAiRunAuditRecord | null }> {
  const startedAt = new Date()
  const generationTimeoutMs = aiGenerationTimeoutMs(input.env, input.config.generationTimeoutMs) ?? resolveQuantAiGenerationTimeout()
  let receivedChars = 0
  let finishReason: string | null = null
  try {
    const summary = await generateQuantAiSummary({
      report: input.report,
      config: input.config,
      timeoutMs: generationTimeoutMs,
      onTextDelta: (delta, receivedLength) => {
        receivedChars = receivedLength
        input.onTextDelta?.(delta, receivedLength)
      },
      onFinishReason: (value) => {
        finishReason = value
        input.onFinishReason?.(value)
      },
      ...(input.signal ? { signal: input.signal } : {}),
    })
    if (input.signal?.aborted)
      throw new QuantError('QUANT_AI_SUMMARY_TIMEOUT', 'AI request was cancelled', 504)
    const generatedAt = new Date()
    const factorImpactSnapshot = buildQuantAiFactorImpact(input.report, summary.factorReviews, generatedAt)
    const persistedSummary = factorImpactSnapshot
      ? { ...summary, factorImpactSnapshot }
      : summary
    const persisted = await createQuantResearchSummary(input.db, {
      userId: input.userId,
      researchRunId: input.run.id,
      summaryVersion: summary.summaryVersion,
      reportVersion: input.report.reportVersion,
      provider: input.config.provider,
      model: input.config.model,
      summaryJson: JSON.stringify(persistedSummary),
      citedEvidenceKeys: summary.citedEvidenceKeys,
      generatedAt,
    })
    const completedAt = new Date()
    const audit = await recordQuantAiRunAudit({
      db: input.db,
      userId: input.userId,
      runId: input.run.id,
      config: input.config,
      generationTimeoutMs,
      status: 'completed',
      receivedChars,
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      finishReason,
      errorCode: null,
      errorMessage: null,
      startedAt,
      completedAt,
      summaryId: persisted.id,
    })
    return { summary: persisted, audit }
  }
  catch (error) {
    const completedAt = new Date()
    const cancelled = input.signal?.aborted === true
    const audit = await recordQuantAiRunAudit({
      db: input.db,
      userId: input.userId,
      runId: input.run.id,
      config: input.config,
      generationTimeoutMs,
      status: cancelled ? 'cancelled' : 'failed',
      receivedChars,
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      finishReason,
      errorCode: error instanceof QuantError ? error.code : 'QUANT_AI_SUMMARY_UPSTREAM',
      errorMessage: error instanceof QuantError ? error.message : 'AI summary generation failed',
      startedAt,
      completedAt,
    })
    throw Object.assign(error instanceof Error ? error : new Error('AI summary generation failed'), { quantAiRunAudit: audit })
  }
}

type QuantAiSummaryStreamEvent
  = | { readonly type: 'started', readonly researchRunId: string, readonly responseMode: QuantAiResponseMode, readonly generationTimeoutMs: number }
    | { readonly type: 'delta', readonly text: string, readonly receivedLength: number }
    | { readonly type: 'completed', readonly data: ReturnType<typeof researchSummaryView> }
    | { readonly type: 'error', readonly code: string, readonly error: string, readonly details: unknown }

function encodeQuantAiSummaryStreamEvent(event: QuantAiSummaryStreamEvent, encoder: TextEncoder): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
}

function quantAiSummaryStreamError(error: unknown): QuantAiSummaryStreamEvent {
  if (error instanceof QuantError) {
    return {
      type: 'error',
      code: error.code,
      error: error.message,
      details: error.details ?? null,
    }
  }
  return {
    type: 'error',
    code: 'QUANT_AI_SUMMARY_UPSTREAM',
    error: 'AI summary generation failed',
    details: null,
  }
}

export function createQuantAiSummaryStream(input: QuantAiSummaryGenerationInput & { readonly requestSignal: AbortSignal }): Response {
  const encoder = new TextEncoder()
  const generationAbort = new AbortController()
  let cancelled = false
  const abortFromRequest = () => {
    cancelled = true
    generationAbort.abort()
  }
  if (input.requestSignal.aborted)
    generationAbort.abort()
  else
    input.requestSignal.addEventListener('abort', abortFromRequest, { once: true })

  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      const emit = (event: QuantAiSummaryStreamEvent): void => {
        if (cancelled)
          return
        try {
          streamController.enqueue(encodeQuantAiSummaryStreamEvent(event, encoder))
        }
        catch {
          cancelled = true
          generationAbort.abort()
        }
      }

      emit({
        type: 'started',
        researchRunId: input.run.id,
        responseMode: input.config.responseMode ?? 'json',
        generationTimeoutMs: aiGenerationTimeoutMs(input.env, input.config.generationTimeoutMs) ?? resolveQuantAiGenerationTimeout(),
      })

      void (async () => {
        try {
          const persisted = await generateAndPersistQuantAiSummary({
            ...input,
            onTextDelta: (text, receivedLength) => emit({ type: 'delta', text, receivedLength }),
            signal: generationAbort.signal,
          })
          emit({ type: 'completed', data: researchSummaryView(persisted.summary, input.report, new Date(), persisted.audit) })
        }
        catch (error) {
          if (!cancelled)
            emit(quantAiSummaryStreamError(error))
        }
        finally {
          input.requestSignal.removeEventListener('abort', abortFromRequest)
          if (!cancelled)
            streamController.close()
        }
      })()
    },
    cancel() {
      cancelled = true
      generationAbort.abort()
      input.requestSignal.removeEventListener('abort', abortFromRequest)
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

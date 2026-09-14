import type { Database } from '@starye/db'
import type { QuantScheduledResearchPorts } from '../../../domain/quant/scheduled-research'
import type { AppEnv } from '../../../types'
import { createDb } from '@starye/db'
import { getDecryptedQuantAiConfig } from '../../../domain/quant/ai-config'
import { getQuantResearchRun, upsertQuantResearchMarker } from '../../../domain/quant/repository'
import { runQuantScheduledResearchTick } from '../../../domain/quant/scheduled-research'
import {
  createQuantScheduledJob,
  finishQuantScheduledJob,
  listQuantScheduledMarkers,
  listQuantScheduledResearchUserIds,
  listQuantScheduledWatchlist,
  readLatestQuantScheduledJob,
  readLatestQuantScheduledReport,
  saveQuantScheduledJobItem,
  takeOverQuantScheduledJob,
} from '../../../domain/quant/scheduled-research-store'
import { syncQuantDaily } from '../../../domain/quant/sync'
import { parseResearchReport } from './presenters'
import { generateQuantResearchRunForUser } from './research-generation'
import { generateAndPersistQuantAiSummary } from './summary-runtime'

function isAiReady(config: Awaited<ReturnType<typeof getDecryptedQuantAiConfig>>): boolean {
  const model = config?.model.trim()
  if (!model || !config)
    return false
  return Boolean(config.apiKey) || config.provider === 'ollama'
}

export function createQuantScheduledResearchPorts(db: Database, env: AppEnv['Bindings']): QuantScheduledResearchPorts {
  return {
    listUserIds: () => listQuantScheduledResearchUserIds(db),
    listWatchlist: (userId: string) => listQuantScheduledWatchlist(db, userId),
    listMarkers: (userId: string) => listQuantScheduledMarkers(db, userId),
    latestReport: (userId: string, tsCode: string) => readLatestQuantScheduledReport(db, userId, tsCode),
    latestJob: (userId: string) => readLatestQuantScheduledJob(db, userId),
    createJob: (input: Parameters<typeof createQuantScheduledJob>[1]) => createQuantScheduledJob(db, input),
    takeOverJob: (jobId: string, now: Date, leaseExpiresAt: Date) => takeOverQuantScheduledJob(db, jobId, now, leaseExpiresAt),
    saveItem: (jobId: string, userId: string, item: Parameters<typeof saveQuantScheduledJobItem>[3], now: Date) => saveQuantScheduledJobItem(db, jobId, userId, item, now),
    finishJob: (job: Parameters<typeof finishQuantScheduledJob>[1], now: Date) => finishQuantScheduledJob(db, job, now),
    syncDaily: async (userId: string, tsCode: string) => {
      const result = await syncQuantDaily(db, env, { tsCodes: [tsCode] }, { userId })
      return { status: result.status }
    },
    generateResearch: async (userId: string, tsCode: string) => {
      const run = await generateQuantResearchRunForUser({ db, env, userId, tsCode })
      return { id: run.id, status: run.status }
    },
    isAiReady: async (userId: string) => isAiReady(await getDecryptedQuantAiConfig(db, userId, env.QUANT_AI_ENCRYPTION_KEY)),
    generateAi: async (userId: string, runId: string) => {
      const run = await getQuantResearchRun(db, userId, runId)
      if (!run)
        return
      const config = await getDecryptedQuantAiConfig(db, userId, env.QUANT_AI_ENCRYPTION_KEY)
      if (!config)
        return
      await generateAndPersistQuantAiSummary({
        db,
        userId,
        run,
        report: parseResearchReport(run.reportJson),
        config,
        env,
      })
    },
    updateReviewDate: async (input: Parameters<QuantScheduledResearchPorts['updateReviewDate']>[0]) => {
      await upsertQuantResearchMarker(db, input)
    },
  }
}

export async function runQuantScheduledResearchFromEnv(env: AppEnv['Bindings'], at = new Date()) {
  const db = createDb(env.DB)
  return runQuantScheduledResearchTick(createQuantScheduledResearchPorts(db, env), at)
}

export function createQuantScheduledResearchHandler(
  run: (env: AppEnv['Bindings'], at: Date) => Promise<unknown> = runQuantScheduledResearchFromEnv,
) {
  return (_controller: unknown, env: AppEnv['Bindings'], context: { waitUntil: (promise: Promise<unknown>) => void }) => {
    context.waitUntil(Promise.resolve()
      .then(() => run(env, new Date()))
      .catch((error: unknown) => {
        console.error('[Quant] scheduled research failed', error instanceof Error ? error.message : 'unknown')
        return { skippedReason: 'failed' }
      }))
  }
}

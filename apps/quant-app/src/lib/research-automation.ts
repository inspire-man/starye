import type { CandidateItem, QuantResearchRun, QuantResearchSummary } from './quant-view-models'

export const MAX_AUTOMATED_RESEARCH_ITEMS = 3

export type AutomatedResearchStage = 'watchlist' | 'research' | 'ai' | 'completed' | 'error'
export type AutomatedResearchAiStatus = 'pending' | 'running' | 'success' | 'skipped' | 'error'
export type AutomatedResearchErrorStage = 'watchlist' | 'research' | 'ai' | null

export type AutomatedResearchCandidate = Pick<CandidateItem, 'tsCode' | 'name'>

const AUTOMATED_RESEARCH_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_-]*$/u
const AUTOMATED_RESEARCH_ERROR_CODE_MAX_LENGTH = 96

export interface AutomatedResearchItemState {
  tsCode: string
  name: string | null
  stage: AutomatedResearchStage
  aiStatus: AutomatedResearchAiStatus
  errorStage: AutomatedResearchErrorStage
  run: QuantResearchRun | null
  summary: QuantResearchSummary | null
  error: unknown | null
}

export interface AutomatedResearchProgress {
  candidate: AutomatedResearchCandidate
  stage: AutomatedResearchStage
  aiStatus: AutomatedResearchAiStatus
  errorStage?: AutomatedResearchErrorStage
  run?: QuantResearchRun | null
  summary?: QuantResearchSummary | null
  error?: unknown | null
}

export interface AutomatedResearchResult {
  candidate: AutomatedResearchCandidate
  status: 'completed' | 'error'
  aiStatus: AutomatedResearchAiStatus
  errorStage: AutomatedResearchErrorStage
  run: QuantResearchRun | null
  summary: QuantResearchSummary | null
  error: unknown | null
}

export interface AutomatedResearchRunner {
  aiReady: boolean
  ensureWatchlist: (candidate: AutomatedResearchCandidate) => Promise<void>
  generateResearch: (candidate: AutomatedResearchCandidate) => Promise<QuantResearchRun>
  generateAiSummary: (run: QuantResearchRun) => Promise<QuantResearchSummary>
}

function normalizeCandidates(candidates: readonly AutomatedResearchCandidate[]): AutomatedResearchCandidate[] {
  const seen = new Set<string>()
  return candidates.flatMap((candidate) => {
    const tsCode = candidate.tsCode.trim().toUpperCase()
    if (!tsCode || seen.has(tsCode))
      return []
    seen.add(tsCode)
    return [{ tsCode, name: candidate.name?.trim() || null }]
  }).slice(0, MAX_AUTOMATED_RESEARCH_ITEMS)
}

export function initialAutomatedResearchStates(candidates: readonly AutomatedResearchCandidate[]): Record<string, AutomatedResearchItemState> {
  return Object.fromEntries(normalizeCandidates(candidates).map(candidate => [candidate.tsCode, {
    tsCode: candidate.tsCode,
    name: candidate.name,
    stage: 'watchlist' as const,
    aiStatus: 'pending' as const,
    errorStage: null,
    run: null,
    summary: null,
    error: null,
  }]))
}

export function applyAutomatedResearchProgress(
  states: Readonly<Record<string, AutomatedResearchItemState>>,
  progress: AutomatedResearchProgress,
): Record<string, AutomatedResearchItemState> {
  const current = states[progress.candidate.tsCode]
  if (!current)
    return { ...states }
  return {
    ...states,
    [progress.candidate.tsCode]: {
      ...current,
      name: progress.candidate.name || current.name,
      stage: progress.stage,
      aiStatus: progress.aiStatus,
      errorStage: progress.errorStage ?? (progress.stage === 'error' ? current.errorStage : null),
      run: progress.run === undefined ? current.run : progress.run,
      summary: progress.summary === undefined ? current.summary : progress.summary,
      error: progress.error === undefined ? current.error : progress.error,
    },
  }
}

export function markAutomatedResearchItemPending(
  states: Readonly<Record<string, AutomatedResearchItemState>>,
  tsCode: string,
): Record<string, AutomatedResearchItemState> {
  const current = states[tsCode]
  if (!current || (current.stage !== 'error' && current.stage !== 'completed'))
    return { ...states }
  return {
    ...states,
    [tsCode]: {
      ...current,
      stage: 'watchlist',
      aiStatus: 'pending',
      errorStage: null,
      run: null,
      summary: null,
      error: null,
    },
  }
}

export function automatedResearchStageLabel(stage: AutomatedResearchStage): string {
  return {
    watchlist: '确认入池',
    research: '生成研究报告',
    ai: 'AI 因子复核',
    completed: '闭环完成',
    error: '该项失败',
  }[stage]
}

export function automatedResearchAiStatusLabel(status: AutomatedResearchAiStatus): string {
  return {
    pending: '待处理',
    running: '复核中',
    success: '已保存',
    skipped: '未配置',
    error: '复核失败',
  }[status]
}

export function automatedResearchErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object')
    return null
  const code = (error as { readonly code?: unknown }).code
  if (typeof code !== 'string')
    return null
  const normalized = code.trim()
  return normalized.length > 0
    && normalized.length <= AUTOMATED_RESEARCH_ERROR_CODE_MAX_LENGTH
    && AUTOMATED_RESEARCH_ERROR_CODE_PATTERN.test(normalized)
    ? normalized
    : null
}

export async function runAutomatedResearch(
  candidates: readonly AutomatedResearchCandidate[],
  runner: AutomatedResearchRunner,
  onProgress: (progress: AutomatedResearchProgress) => void = () => {},
): Promise<AutomatedResearchResult[]> {
  const items = normalizeCandidates(candidates)
  const results: AutomatedResearchResult[] = []

  for (const candidate of items) {
    let stage: AutomatedResearchStage = 'watchlist'
    let aiStatus: AutomatedResearchAiStatus = 'pending'
    let run: QuantResearchRun | null = null
    let summary: QuantResearchSummary | null = null
    onProgress({ candidate, stage, aiStatus, errorStage: null, run, summary, error: null })
    try {
      await runner.ensureWatchlist(candidate)
      stage = 'research'
      onProgress({ candidate, stage, aiStatus, errorStage: null, run, summary, error: null })
      run = await runner.generateResearch(candidate)
      if (!runner.aiReady) {
        aiStatus = 'skipped'
        stage = 'completed'
        onProgress({ candidate, stage, aiStatus, errorStage: null, run, summary, error: null })
        results.push({ candidate, status: 'completed', aiStatus, errorStage: null, run, summary, error: null })
        continue
      }

      stage = 'ai'
      aiStatus = 'running'
      onProgress({ candidate, stage, aiStatus, errorStage: null, run, summary, error: null })
      summary = await runner.generateAiSummary(run)
      aiStatus = 'success'
      stage = 'completed'
      onProgress({ candidate, stage, aiStatus, errorStage: null, run, summary, error: null })
      results.push({ candidate, status: 'completed', aiStatus, errorStage: null, run, summary, error: null })
    }
    catch (error) {
      const errorStage: AutomatedResearchErrorStage = stage === 'watchlist' || stage === 'research' || stage === 'ai' ? stage : 'research'
      aiStatus = errorStage === 'ai' ? 'error' : aiStatus
      stage = 'error'
      onProgress({ candidate, stage, aiStatus, errorStage, run, summary, error })
      results.push({ candidate, status: 'error', aiStatus, errorStage, run, summary, error })
    }
  }

  return results
}

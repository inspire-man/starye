import type {
  CrawlerTaskTemplateKey,
  ProviderAssociationSummary,
  ProviderDispatchInput,
  ProviderRunConclusion,
  ProviderRunStatus,
  ProviderSnapshot,
} from './types'
import { getCrawlerTaskTemplate, isCrawlerTaskTemplateKey } from './template-registry'

const providerWorkflowRegistry = Object.freeze({
  manga: Object.freeze({
    crawlerEntrypoint: 'crawler-comic',
    environment: 'starye-org',
    provider: 'github-actions',
    ref: 'main',
    repository: 'inspire-man/starye',
    target: 'starye-org',
    workflow: '.github/workflows/daily-manga-crawl.yml',
  }),
  movie: Object.freeze({
    crawlerEntrypoint: 'crawler-optimized',
    environment: 'starye-org',
    provider: 'github-actions',
    ref: 'main',
    repository: 'inspire-man/starye',
    target: 'starye-org',
    workflow: '.github/workflows/daily-movie-crawl.yml',
  }),
} as const satisfies Record<CrawlerTaskTemplateKey, Omit<ProviderSnapshot, 'templateKey'>>)

const FIXED_PROVIDER_REPOSITORY = 'inspire-man/starye' as const

const providerRunStatuses = new Set<ProviderRunStatus>([
  'completed',
  'in_progress',
  'pending',
  'queued',
  'requested',
  'waiting',
])

const providerRunConclusions = new Set<ProviderRunConclusion>([
  'action_required',
  'cancelled',
  'failure',
  'neutral',
  'skipped',
  'stale',
  'startup_failure',
  'success',
  'timed_out',
])

function asRecord(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(code)

  return value as Readonly<Record<string, unknown>>
}

function requireExactKeys(record: Readonly<Record<string, unknown>>, keys: readonly string[], code: string): void {
  if (Object.keys(record).some(key => !keys.includes(key)))
    throw new Error(code)
}

function requireRunId(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][\w-]{0,127}$/u.test(value))
    throw new Error(code)

  return value
}

function requirePositiveInteger(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647)
    throw new Error(code)

  return value
}

function optionalProviderRunId(value: unknown): string | undefined {
  if (value === undefined)
    return undefined

  if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/u.test(value))
    throw new Error('provider_summary_invalid')

  return value
}

function optionalProviderRunAttempt(value: unknown): number | undefined {
  if (value === undefined)
    return undefined

  return requirePositiveInteger(value, 'provider_summary_invalid')
}

function optionalProviderStatus(value: unknown): ProviderRunStatus | undefined {
  if (value === undefined)
    return undefined

  if (typeof value !== 'string' || !providerRunStatuses.has(value as ProviderRunStatus))
    throw new Error('provider_summary_invalid')

  return value as ProviderRunStatus
}

function optionalProviderConclusion(value: unknown): ProviderRunConclusion | undefined {
  if (value === undefined)
    return undefined

  if (typeof value !== 'string' || !providerRunConclusions.has(value as ProviderRunConclusion))
    throw new Error('provider_summary_invalid')

  return value as ProviderRunConclusion
}

function optionalSha(value: unknown): string | undefined {
  if (value === undefined)
    return undefined

  if (typeof value !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(value))
    throw new Error('provider_summary_invalid')

  return value
}

function optionalFixedMetadata<const T extends string>(value: unknown, expected: T, code: string): T | undefined {
  if (value === undefined)
    return undefined
  if (value !== expected)
    throw new Error(code)
  return expected
}

/** Resolves the immutable provider identity from the already-closed crawler template registry. */
export function createProviderSnapshot(templateKey: unknown): ProviderSnapshot {
  if (!isCrawlerTaskTemplateKey(templateKey))
    throw new Error('provider_template_invalid')

  const template = getCrawlerTaskTemplate(templateKey)
  const workflow = providerWorkflowRegistry[template.templateKey]
  return Object.freeze({
    ...workflow,
    templateKey: template.templateKey,
  })
}

/** Builds the exact workflow_dispatch inputs and rejects all caller-supplied provider controls. */
export function createProviderDispatchInput(input: unknown): ProviderDispatchInput {
  const record = asRecord(input, 'provider_dispatch_input_invalid')
  requireExactKeys(record, ['attempt', 'runId', 'templateKey'], 'provider_dispatch_input_invalid')

  const snapshot = createProviderSnapshot(record.templateKey)
  return Object.freeze({
    attempt: requirePositiveInteger(record.attempt, 'provider_dispatch_input_invalid'),
    runId: requireRunId(record.runId, 'provider_dispatch_input_invalid'),
    target: snapshot.target,
    template: snapshot.templateKey,
  })
}

/** Produces a bounded, redacted provider projection that deliberately excludes credentials and workflow controls. */
export function createProviderAssociationSummary(input: unknown): ProviderAssociationSummary {
  const record = asRecord(input, 'provider_summary_invalid')
  requireExactKeys(
    record,
    [
      'environment',
      'providerConclusion',
      'providerRunAttempt',
      'providerRunId',
      'providerStatus',
      'ref',
      'repository',
      'sha',
      'workflow',
    ],
    'provider_summary_invalid',
  )

  const providerRunId = optionalProviderRunId(record.providerRunId)
  const providerRunAttempt = optionalProviderRunAttempt(record.providerRunAttempt)
  const providerStatus = optionalProviderStatus(record.providerStatus)
  const providerConclusion = optionalProviderConclusion(record.providerConclusion)
  const sha = optionalSha(record.sha)
  const environment = optionalFixedMetadata(record.environment, 'starye-org', 'provider_summary_invalid')
  const ref = optionalFixedMetadata(record.ref, 'main', 'provider_summary_invalid')
  const suppliedRepository = optionalFixedMetadata(record.repository, FIXED_PROVIDER_REPOSITORY, 'provider_summary_invalid')
  const repository = suppliedRepository ?? (providerRunId ? FIXED_PROVIDER_REPOSITORY : undefined)
  const workflow = record.workflow === undefined
    ? undefined
    : (record.workflow === '.github/workflows/daily-manga-crawl.yml' || record.workflow === '.github/workflows/daily-movie-crawl.yml'
        ? record.workflow
        : (() => { throw new Error('provider_summary_invalid') })())

  if (record.providerRunUrl !== undefined)
    throw new Error('provider_summary_invalid')

  const providerRunUrl = providerRunId && repository
    ? `https://github.com/${repository}/actions/runs/${providerRunId}`
    : undefined

  return Object.freeze({
    provider: 'github-actions',
    ...(environment ? { environment } : {}),
    ...(providerRunId ? { providerRunId } : {}),
    ...(providerRunUrl ? { providerRunUrl } : {}),
    ...(providerRunAttempt ? { providerRunAttempt } : {}),
    ...(providerStatus ? { providerStatus } : {}),
    ...(providerConclusion ? { providerConclusion } : {}),
    ...(ref ? { ref } : {}),
    ...(repository ? { repository } : {}),
    ...(sha ? { sha } : {}),
    ...(workflow ? { workflow } : {}),
  })
}

import type { TargetPagesSurface } from './target-profile.schema'
import type { TargetResolution } from './target-resolver'

export type LiveResourceKind = 'd1' | 'r2' | 'kv' | 'api-worker' | 'gateway-worker' | 'pages'

export interface WranglerCommandResult {
  exitCode: number
  stdout?: string
  stderr?: string
}

export interface WranglerCommandExecutor {
  execute: (argv: readonly string[]) => WranglerCommandResult
}

export interface LiveResourceCheck {
  resource: LiveResourceKind
  argv: readonly string[]
  expectedOutput?: string
}

export type LiveResourceCheckIssueCode
  = | 'remote-resource-check-failed'
    | 'remote-resource-missing'

export interface LiveResourceCheckIssue {
  code: LiveResourceCheckIssueCode
  message: string
}

const liveResourceCheckAttempts = 3

export function buildLiveResourceChecks(
  resolution: TargetResolution,
  pagesSurface?: TargetPagesSurface,
  includeWorkers = true,
): readonly LiveResourceCheck[] {
  const checks: LiveResourceCheck[] = [
    {
      resource: 'd1',
      argv: ['d1', 'info', resolution.profile.resources.d1.name],
    },
    {
      resource: 'r2',
      argv: ['r2', 'bucket', 'info', resolution.profile.resources.r2.name],
    },
    {
      resource: 'kv',
      argv: ['kv', 'namespace', 'list'],
      expectedOutput: resolution.profile.resources.kv.id,
    },
  ]

  if (includeWorkers) {
    checks.push(
      {
        resource: 'api-worker',
        argv: ['versions', 'list', '--name', resolution.profile.workers.api.name],
      },
      {
        resource: 'gateway-worker',
        argv: ['versions', 'list', '--name', resolution.profile.workers.gateway.name],
      },
    )
  }

  if (pagesSurface) {
    checks.push({
      resource: 'pages',
      argv: ['pages', 'project', 'list'],
      expectedOutput: resolution.profile.pages[pagesSurface].project,
    })
  }

  return checks
}

function resourceIdentity(resolution: TargetResolution, resource: LiveResourceKind): string {
  if (resource === 'd1') {
    return resolution.profile.resources.d1.name
  }

  if (resource === 'r2') {
    return resolution.profile.resources.r2.name
  }

  if (resource === 'kv') {
    return resolution.profile.resources.kv.id
  }

  if (resource === 'api-worker') {
    return resolution.profile.workers.api.name
  }

  if (resource === 'gateway-worker') {
    return resolution.profile.workers.gateway.name
  }

  return 'selected Pages project'
}

function describeCheck(resolution: TargetResolution, check: LiveResourceCheck): string {
  const identity = check.resource === 'pages'
    ? check.expectedOutput ?? 'selected Pages project'
    : resourceIdentity(resolution, check.resource)
  return `Target ${resolution.id}: read-only ${check.resource} resource check for ${identity}`
}

function sanitizeDiagnostic(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.replace(/\s+/gu, ' ').trim()
  if (!normalized) {
    return undefined
  }

  return normalized
    .replace(/(?:CLOUDFLARE_API_TOKEN|CLOUDFLARE_API_KEY|CLOUDFLARE_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)\s*(?:=|:)\s*\S+/giu, '[redacted]')
    .replace(/Authorization\s*:\s*Bearer\s+\S+/giu, 'Authorization: Bearer [redacted]')
    .slice(0, 240)
}

function describeFailedCheck(
  resolution: TargetResolution,
  check: LiveResourceCheck,
  attempts: number,
  exitCode: number | undefined,
  diagnostic: string | undefined,
): string {
  const attemptLabel = attempts === 1
    ? `${attempts} attempt`
    : `${attempts} attempts`
  const exitLabel = exitCode === undefined ? 'without an exit code' : `with exit code ${exitCode}`
  const diagnosticLabel = diagnostic ? ` Diagnostic: ${diagnostic}` : ''
  return `${describeCheck(resolution, check)} failed after ${attemptLabel} ${exitLabel}.${diagnosticLabel}`
}

export function runLiveResourceChecks(
  resolution: TargetResolution,
  executor: WranglerCommandExecutor,
  pagesSurface?: TargetPagesSurface,
  includeWorkers = true,
): LiveResourceCheckIssue[] {
  const issues: LiveResourceCheckIssue[] = []

  for (const check of buildLiveResourceChecks(resolution, pagesSurface, includeWorkers)) {
    let failure: {
      attempts: number
      exitCode?: number
      diagnostic?: string
    } | undefined

    for (let attempt = 1; attempt <= liveResourceCheckAttempts; attempt += 1) {
      try {
        const result: WranglerCommandResult = executor.execute(check.argv)
        if (result.exitCode === 0) {
          if (check.expectedOutput && !result.stdout?.includes(check.expectedOutput)) {
            issues.push({
              code: 'remote-resource-missing',
              message: `${describeCheck(resolution, check)} did not find the selected target resource.`,
            })
          }
          failure = undefined
          break
        }

        const diagnostic = sanitizeDiagnostic(result.stderr)
        failure = {
          attempts: attempt,
          exitCode: result.exitCode,
          ...(diagnostic ? { diagnostic } : {}),
        }
      }
      catch (error) {
        const diagnostic = sanitizeDiagnostic(error instanceof Error ? error.message : error)
        failure = {
          attempts: attempt,
          ...(diagnostic ? { diagnostic } : {}),
        }
      }
    }

    if (failure) {
      issues.push({
        code: 'remote-resource-check-failed',
        message: describeFailedCheck(
          resolution,
          check,
          failure.attempts,
          failure.exitCode,
          failure.diagnostic,
        ),
      })
    }
  }

  return issues
}

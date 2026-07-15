import type { TargetPagesSurface } from './target-profile.schema'
import type { TargetResolution } from './target-resolver'

export type LiveResourceKind = 'd1' | 'r2' | 'kv' | 'api-worker' | 'gateway-worker' | 'pages'

export interface WranglerCommandResult {
  exitCode: number
  stdout?: string
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

export function buildLiveResourceChecks(
  resolution: TargetResolution,
  pagesSurface?: TargetPagesSurface,
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
    {
      resource: 'api-worker',
      argv: ['deployments', 'list', '--name', resolution.profile.workers.api.name],
      expectedOutput: resolution.profile.workers.api.name,
    },
    {
      resource: 'gateway-worker',
      argv: ['deployments', 'list', '--name', resolution.profile.workers.gateway.name],
      expectedOutput: resolution.profile.workers.gateway.name,
    },
  ]

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

export function runLiveResourceChecks(
  resolution: TargetResolution,
  executor: WranglerCommandExecutor,
  pagesSurface?: TargetPagesSurface,
): LiveResourceCheckIssue[] {
  const issues: LiveResourceCheckIssue[] = []

  for (const check of buildLiveResourceChecks(resolution, pagesSurface)) {
    let result: WranglerCommandResult

    try {
      result = executor.execute(check.argv)
    }
    catch {
      issues.push({
        code: 'remote-resource-check-failed',
        message: `${describeCheck(resolution, check)} could not run.`,
      })
      continue
    }

    if (result.exitCode !== 0) {
      issues.push({
        code: 'remote-resource-check-failed',
        message: `${describeCheck(resolution, check)} failed.`,
      })
      continue
    }

    if (check.expectedOutput && !result.stdout?.includes(check.expectedOutput)) {
      issues.push({
        code: 'remote-resource-missing',
        message: `${describeCheck(resolution, check)} did not find the selected target resource.`,
      })
    }
  }

  return issues
}

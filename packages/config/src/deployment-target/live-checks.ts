import type { TargetResolution } from './target-resolver'

export type LiveResourceKind = 'd1' | 'r2' | 'kv'

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

export function buildLiveResourceChecks(resolution: TargetResolution): readonly LiveResourceCheck[] {
  return [
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
}

function resourceIdentity(resolution: TargetResolution, resource: LiveResourceKind): string {
  if (resource === 'd1') {
    return resolution.profile.resources.d1.name
  }

  if (resource === 'r2') {
    return resolution.profile.resources.r2.name
  }

  return resolution.profile.resources.kv.id
}

function describeCheck(resolution: TargetResolution, check: LiveResourceCheck): string {
  return `Target ${resolution.id}: read-only ${check.resource} resource check for ${resourceIdentity(resolution, check.resource)}`
}

export function runLiveResourceChecks(
  resolution: TargetResolution,
  executor: WranglerCommandExecutor,
): LiveResourceCheckIssue[] {
  const issues: LiveResourceCheckIssue[] = []

  for (const check of buildLiveResourceChecks(resolution)) {
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

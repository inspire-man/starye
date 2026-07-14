import type { ProjectionValidationIssue } from './projection-plan'
import type { TargetResolution } from './target-resolver'
import {
  resolveTargetProfile,
  TargetResolutionError,
} from './target-resolver'

export const preflightScopeValues = ['local', 'ci', 'remote'] as const

export type PreflightScope = (typeof preflightScopeValues)[number]

export const preflightCommandValues = [
  'validate',
  'project-local',
  'preflight',
  'deploy',
  'migrate',
  'rollback',
  'remote-crawl',
  'smoke',
] as const

export type PreflightCommand = (typeof preflightCommandValues)[number]

export const remoteLiveCheckCommandValues = [
  'deploy',
  'migrate',
  'rollback',
  'remote-crawl',
  'smoke',
] as const

export type RemoteLiveCheckCommand = (typeof remoteLiveCheckCommandValues)[number]

export type PreflightIssueCode
  = | 'missing-selected-target'
    | 'unknown-target'
    | 'invalid-target-profile'
    | 'legacy-target-alias'
    | 'invalid-scope'
    | 'invalid-command'
    | 'projection-mismatch'
    | 'local-wrangler-profile-mismatch'
    | 'local-api-token-shadowing'
    | 'ci-environment-mismatch'

export interface PreflightIssue {
  code: PreflightIssueCode
  message: string
  blocking: true
}

export interface PreflightOptions {
  target: string
  scope: PreflightScope | string
  command: PreflightCommand | string
  wranglerProfile?: string
  ciEnvironment?: string
  projectionIssues?: readonly ProjectionValidationIssue[]
  environment?: Readonly<Record<string, string | undefined>>
}

export interface TargetPreflightResult {
  target?: TargetResolution
  issues: readonly PreflightIssue[]
  ok: boolean
}

const legacyTargetAliasValues = new Set([
  'default',
  'prod',
  'production',
  'starye.org',
  'www.starye.org',
  'api.starye.org',
])

function normalizedText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized || undefined
}

function isPreflightScope(value: string): value is PreflightScope {
  return (preflightScopeValues as readonly string[]).includes(value)
}

function isPreflightCommand(value: string): value is PreflightCommand {
  return (preflightCommandValues as readonly string[]).includes(value)
}

function addIssue(issues: PreflightIssue[], code: PreflightIssueCode, message: string): void {
  issues.push({ code, message, blocking: true })
}

function describeProjectionIssue(issue: ProjectionValidationIssue): string {
  if (issue.kind === 'target-managed-mismatch') {
    return `Projected target value mismatch at ${issue.file}: ${issue.key}.`
  }

  return `Required user-managed secret key is missing at ${issue.file}: ${issue.key}.`
}

function resolveSelectedTarget(target: unknown, issues: PreflightIssue[]): TargetResolution | undefined {
  const selectedTarget = normalizedText(target)

  if (selectedTarget && legacyTargetAliasValues.has(selectedTarget.toLowerCase())) {
    addIssue(
      issues,
      'legacy-target-alias',
      `Legacy target alias is not allowed: ${selectedTarget}. Pass an explicit tracked target id.`,
    )
    return undefined
  }

  try {
    return resolveTargetProfile(selectedTarget)
  }
  catch (error) {
    if (error instanceof TargetResolutionError) {
      addIssue(issues, error.code, error.message)
      return undefined
    }

    addIssue(issues, 'invalid-target-profile', 'Target profile could not be validated.')
    return undefined
  }
}

function validateProjection(
  projectionIssues: readonly ProjectionValidationIssue[] | undefined,
  issues: PreflightIssue[],
): void {
  for (const issue of projectionIssues ?? []) {
    addIssue(issues, 'projection-mismatch', describeProjectionIssue(issue))
  }
}

function validateCommandInput(
  scope: unknown,
  command: unknown,
  issues: PreflightIssue[],
): { scope?: PreflightScope, command?: PreflightCommand } {
  const selectedScope = normalizedText(scope)
  const selectedCommand = normalizedText(command)
  const validated: { scope?: PreflightScope, command?: PreflightCommand } = {}

  if (!selectedScope || !isPreflightScope(selectedScope)) {
    addIssue(issues, 'invalid-scope', 'Scope must be one of: local, ci, remote.')
  }
  else {
    validated.scope = selectedScope
  }

  if (!selectedCommand || !isPreflightCommand(selectedCommand)) {
    addIssue(issues, 'invalid-command', 'Command must be an explicit supported target-profile command.')
  }
  else {
    validated.command = selectedCommand
  }

  return validated
}

function validateIdentityBoundary(
  resolution: TargetResolution | undefined,
  scope: PreflightScope | undefined,
  options: PreflightOptions,
  issues: PreflightIssue[],
): void {
  if (!resolution || !scope) {
    return
  }

  if (scope === 'local') {
    if (normalizedText(options.wranglerProfile) !== resolution.profile.local.wranglerProfile) {
      addIssue(
        issues,
        'local-wrangler-profile-mismatch',
        `Local Wrangler profile must be ${resolution.profile.local.wranglerProfile}.`,
      )
    }

    if (normalizedText(options.environment?.CLOUDFLARE_API_TOKEN)) {
      addIssue(
        issues,
        'local-api-token-shadowing',
        'Local scope must not set CLOUDFLARE_API_TOKEN while using a Wrangler profile.',
      )
    }

    return
  }

  if (normalizedText(options.ciEnvironment) !== resolution.profile.ci.githubEnvironment) {
    addIssue(
      issues,
      'ci-environment-mismatch',
      `CI GitHub environment must be ${resolution.profile.ci.githubEnvironment}.`,
    )
  }
}

export function runTargetPreflight(options: PreflightOptions): TargetPreflightResult {
  const issues: PreflightIssue[] = []
  const target = resolveSelectedTarget(options.target, issues)
  const input = validateCommandInput(options.scope, options.command, issues)

  validateProjection(options.projectionIssues, issues)
  validateIdentityBoundary(target, input.scope, options, issues)

  return {
    ...(target ? { target } : {}),
    issues,
    ok: issues.length === 0,
  }
}

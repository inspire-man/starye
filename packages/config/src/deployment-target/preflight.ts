import type { WranglerCommandExecutor } from './live-checks'
import type { ProjectionValidationIssue } from './projection-plan'
import type { TargetResolution } from './target-resolver'
import { runLiveResourceChecks } from './live-checks'
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
    | 'missing-remote-credentials'
    | 'remote-account-id-mismatch'
    | 'missing-live-resource-check'
    | 'remote-resource-check-failed'
    | 'remote-resource-missing'

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
  live?: boolean
  liveCheckExecutor?: WranglerCommandExecutor
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

function isRemoteLiveCheckCommand(command: PreflightCommand): command is RemoteLiveCheckCommand {
  return (remoteLiveCheckCommandValues as readonly string[]).includes(command)
}

function addIssue(issues: PreflightIssue[], code: PreflightIssueCode, message: string): void {
  issues.push({ code, message, blocking: true })
}

function describeProjectionIssue(issue: ProjectionValidationIssue): string {
  if (issue.kind === 'target-managed-mismatch') {
    return `Projected target value mismatch at ${issue.file}: ${issue.key}.`
  }

  if (issue.kind === 'missing-user-managed-secret') {
    return `Required user-managed secret key is missing at ${issue.file}: ${issue.key}.`
  }

  if (issue.kind === 'missing-projection-file') {
    return `Projected env file is missing: ${issue.file}.`
  }

  return `Target-managed env markers are malformed at ${issue.file}.`
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

function validateRemoteLiveCheck(
  resolution: TargetResolution | undefined,
  input: { scope?: PreflightScope, command?: PreflightCommand },
  options: PreflightOptions,
  issues: PreflightIssue[],
): void {
  if (!resolution || !input.scope || !input.command || input.scope === 'local' || !isRemoteLiveCheckCommand(input.command)) {
    return
  }

  const environment = options.environment ?? {}
  const requiredCredentialKeys = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] as const
  const missingCredentialKeys = requiredCredentialKeys.filter(key => !normalizedText(environment[key]))

  if (missingCredentialKeys.length > 0) {
    addIssue(
      issues,
      'missing-remote-credentials',
      `Remote scope requires credential keys: ${missingCredentialKeys.join(', ')}.`,
    )
    return
  }

  if (normalizedText(environment.CLOUDFLARE_ACCOUNT_ID) !== resolution.profile.account.id) {
    addIssue(
      issues,
      'remote-account-id-mismatch',
      'Remote CLOUDFLARE_ACCOUNT_ID does not match the selected target profile.',
    )
    return
  }

  if (!options.live || !options.liveCheckExecutor) {
    addIssue(
      issues,
      'missing-live-resource-check',
      'Remote high-risk commands require --live and a read-only resource check executor.',
    )
    return
  }

  if (issues.length > 0) {
    return
  }

  for (const issue of runLiveResourceChecks(resolution, options.liveCheckExecutor)) {
    addIssue(issues, issue.code, issue.message)
  }
}

export function runTargetPreflight(options: PreflightOptions): TargetPreflightResult {
  const issues: PreflightIssue[] = []
  const target = resolveSelectedTarget(options.target, issues)
  const input = validateCommandInput(options.scope, options.command, issues)

  validateProjection(options.projectionIssues, issues)
  validateIdentityBoundary(target, input.scope, options, issues)
  validateRemoteLiveCheck(target, input, options, issues)

  return {
    ...(target ? { target } : {}),
    issues,
    ok: issues.length === 0,
  }
}

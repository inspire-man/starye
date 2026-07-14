import type { PreflightOptions } from '../preflight'
import { describe, expect, it, vi } from 'vitest'
import { buildLiveResourceChecks, runLiveResourceChecks } from '../live-checks'
import {

  runTargetPreflight,
} from '../preflight'
import { resolveTargetProfile } from '../target-resolver'

function createRemoteOptions(overrides: Partial<PreflightOptions> = {}): PreflightOptions {
  return {
    target: 'starye-org',
    scope: 'remote',
    command: 'deploy',
    ciEnvironment: 'starye-org',
    environment: {
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_ACCOUNT_ID: '27c162f54c8f59fff74224775a59937e',
    },
    live: true,
    ...overrides,
  }
}

describe('live resource checks', () => {
  it('builds argv-only D1, R2, and KV read checks for the resolved target', () => {
    const checks = buildLiveResourceChecks(resolveTargetProfile('starye-org'))

    expect(checks).toEqual([
      expect.objectContaining({
        resource: 'd1',
        argv: ['d1', 'info', 'starye-db'],
      }),
      expect.objectContaining({
        resource: 'r2',
        argv: ['r2', 'bucket', 'info', 'starye-media'],
      }),
      expect.objectContaining({
        resource: 'kv',
        argv: ['kv', 'namespace', 'list'],
      }),
    ])
    expect(checks.every(check => Array.isArray(check.argv))).toBe(true)
    expect(checks.flatMap(check => check.argv).join(' ')).not.toContain('&&')
  })

  it('runs all read checks through an injected argv executor', () => {
    const execute = vi.fn((argv: readonly string[]) => ({
      exitCode: 0,
      stdout: argv[0] === 'kv' ? 'f7f6a8c2bff84a1d89da528eab4eb559' : '',
    }))

    const result = runTargetPreflight(createRemoteOptions({
      liveCheckExecutor: { execute },
    }))

    expect(result.ok).toBe(true)
    expect(execute.mock.calls.map(([argv]) => argv)).toEqual([
      ['d1', 'info', 'starye-db'],
      ['r2', 'bucket', 'info', 'starye-media'],
      ['kv', 'namespace', 'list'],
    ])
  })

  it.each(['deploy', 'migrate', 'rollback', 'remote-crawl', 'smoke'] as const)(
    'fails closed for remote %s when Cloudflare credential keys are absent',
    (command) => {
      const result = runTargetPreflight(createRemoteOptions({
        command,
        environment: {},
      }))

      expect(result.ok).toBe(false)
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'missing-remote-credentials',
        blocking: true,
      }))
    },
  )

  it('blocks a remote credential bundle whose account id does not match the selected target', () => {
    const result = runTargetPreflight(createRemoteOptions({
      environment: {
        CLOUDFLARE_API_TOKEN: 'test-token',
        CLOUDFLARE_ACCOUNT_ID: 'different-account-id',
      },
    }))

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'remote-account-id-mismatch',
      blocking: true,
    }))
  })

  it('blocks a KV response that does not contain the tracked namespace id', () => {
    const result = runTargetPreflight(createRemoteOptions({
      liveCheckExecutor: {
        execute: () => ({ exitCode: 0, stdout: 'different-namespace-id' }),
      },
    }))

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'remote-resource-missing',
      blocking: true,
    }))
  })

  it('identifies a thrown D1 check by selected target and resource without echoing executor data', () => {
    const issues = runLiveResourceChecks(resolveTargetProfile('starye-org'), {
      execute: () => {
        throw new Error('CLOUDFLARE_API_TOKEN=token-must-not-appear')
      },
    })
    const d1Issue = issues.find(issue => issue.code === 'remote-resource-check-failed')

    expect(d1Issue?.message).toContain('starye-org')
    expect(d1Issue?.message).toContain('starye-db')
    expect(d1Issue?.message).not.toContain('CLOUDFLARE_API_TOKEN')
    expect(d1Issue?.message).not.toContain('token-must-not-appear')
  })

  it('identifies a non-zero R2 check without echoing command output', () => {
    const issues = runLiveResourceChecks(resolveTargetProfile('starye-org'), {
      execute: argv => ({
        exitCode: argv[0] === 'r2' ? 1 : 0,
        stdout: 'executor-output-must-not-appear',
      }),
    })
    const r2Issue = issues.find(issue => issue.code === 'remote-resource-check-failed')

    expect(r2Issue?.message).toContain('starye-org')
    expect(r2Issue?.message).toContain('starye-media')
    expect(r2Issue?.message).not.toContain('executor-output-must-not-appear')
  })

  it('identifies a missing KV namespace without echoing token-like output', () => {
    const issues = runLiveResourceChecks(resolveTargetProfile('starye-org'), {
      execute: argv => ({
        exitCode: 0,
        stdout: argv[0] === 'kv' ? 'CLOUDFLARE_API_TOKEN=token-must-not-appear' : '',
      }),
    })
    const kvIssue = issues.find(issue => issue.code === 'remote-resource-missing')

    expect(kvIssue?.message).toContain('starye-org')
    expect(kvIssue?.message).toContain('f7f6a8c2bff84a1d89da528eab4eb559')
    expect(kvIssue?.message).not.toContain('CLOUDFLARE_API_TOKEN')
    expect(kvIssue?.message).not.toContain('token-must-not-appear')
  })
})

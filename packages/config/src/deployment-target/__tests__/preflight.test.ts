import type { PreflightOptions } from '../preflight'
import { describe, expect, it } from 'vitest'
import {

  runTargetPreflight,
} from '../preflight'

function createOptions(overrides: Partial<PreflightOptions> = {}): PreflightOptions {
  return {
    target: 'starye-org',
    scope: 'local',
    command: 'validate',
    wranglerProfile: 'starye-org',
    ...overrides,
  }
}

describe('runTargetPreflight', () => {
  it('returns one blocking result that combines projection, identity, and command failures', () => {
    const result = runTargetPreflight(createOptions({
      scope: 'remote',
      command: 'not-a-command' as PreflightOptions['command'],
      ciEnvironment: 'other-environment',
      projectionIssues: [
        {
          kind: 'target-managed-mismatch',
          file: 'apps/api/.dev.vars',
          key: 'STARYE_TARGET_ID',
          expected: 'starye-org',
          actual: 'different-target',
        },
      ],
    }))

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-command', blocking: true }),
      expect.objectContaining({ code: 'ci-environment-mismatch', blocking: true }),
      expect.objectContaining({ code: 'projection-mismatch', blocking: true }),
    ]))
    expect(result.issues.every(issue => issue.blocking)).toBe(true)
  })

  it.each(['default', 'prod', 'production', 'starye.org', 'api.starye.org'])(
    'rejects legacy target alias %s without falling back to starye-org',
    (target) => {
      const result = runTargetPreflight(createOptions({ target }))

      expect(result.target).toBeUndefined()
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'legacy-target-alias',
        blocking: true,
      }))
    },
  )

  it('requires an explicit target and preserves the resolver failure code', () => {
    const result = runTargetPreflight(createOptions({ target: '   ' }))

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'missing-selected-target',
      blocking: true,
    }))
  })
})

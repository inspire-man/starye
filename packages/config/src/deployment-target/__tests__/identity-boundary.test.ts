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

describe('target identity boundaries', () => {
  it('requires the tracked local Wrangler profile', () => {
    const result = runTargetPreflight(createOptions({ wranglerProfile: 'personal' }))

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'local-wrangler-profile-mismatch',
      blocking: true,
    }))
  })

  it('rejects a local CLOUDFLARE_API_TOKEN shadowing a Wrangler profile without printing its value', () => {
    const tokenValue = 'local-token-value-must-not-leak'
    const result = runTargetPreflight(createOptions({
      environment: { CLOUDFLARE_API_TOKEN: tokenValue },
    }))

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'local-api-token-shadowing',
      blocking: true,
    }))
    expect(result.issues.map(issue => issue.message).join('\n')).not.toContain(tokenValue)
  })

  it.each(['ci', 'remote'] as const)(
    'requires the mapped GitHub environment in %s scope',
    (scope) => {
      const result = runTargetPreflight(createOptions({
        scope,
        command: 'deploy',
        ciEnvironment: 'other-environment',
      }))

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'ci-environment-mismatch',
        blocking: true,
      }))
    },
  )
})

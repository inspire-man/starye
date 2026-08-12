import { describe, expect, it } from 'vitest'
import {
  createProviderAssociationSummary,
  createProviderDispatchInput,
  createProviderSnapshot,
} from '../provider-association'

describe('provider association registry', () => {
  it.each([
    {
      crawlerEntrypoint: 'crawler-optimized',
      templateKey: 'movie' as const,
      workflow: '.github/workflows/daily-movie-crawl.yml',
    },
    {
      crawlerEntrypoint: 'crawler-comic',
      templateKey: 'manga' as const,
      workflow: '.github/workflows/daily-manga-crawl.yml',
    },
  ])('creates an immutable server-owned $templateKey snapshot', ({ crawlerEntrypoint, templateKey, workflow }) => {
    const snapshot = createProviderSnapshot(templateKey)

    expect(snapshot).toEqual({
      crawlerEntrypoint,
      environment: 'starye-org',
      provider: 'github-actions',
      ref: 'main',
      repository: 'inspire-man/starye',
      target: 'starye-org',
      templateKey,
      workflow,
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
  })

  it('fails closed for unknown templates and caller-controlled workflow fields', () => {
    expect(() => createProviderSnapshot('actor')).toThrow('provider_template_invalid')
    expect(() => createProviderDispatchInput({
      attempt: 1,
      runId: 'run-1',
      templateKey: 'movie',
      workflow: '.github/workflows/other.yml',
    })).toThrow('provider_dispatch_input_invalid')
  })

  it('emits only the closed dispatch tuple', () => {
    expect(createProviderDispatchInput({
      attempt: 2,
      runId: 'run-1',
      templateKey: 'movie',
    })).toEqual({
      attempt: 2,
      runId: 'run-1',
      target: 'starye-org',
      template: 'movie',
    })
  })

  it('redacts provider summaries to bounded safe fields', () => {
    const summary = createProviderAssociationSummary({
      providerConclusion: 'success',
      providerRunAttempt: 3,
      providerRunId: '12345678901234567890',
      providerStatus: 'completed',
      sha: 'a'.repeat(40),
    })

    expect(summary).toEqual({
      provider: 'github-actions',
      providerConclusion: 'success',
      providerRunAttempt: 3,
      providerRunId: '12345678901234567890',
      providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/12345678901234567890',
      providerStatus: 'completed',
      repository: 'inspire-man/starye',
      sha: 'a'.repeat(40),
    })
    expect(() => createProviderAssociationSummary({
      providerRunId: '1',
      token: 'must-not-cross-the-boundary',
    })).toThrow('provider_summary_invalid')
  })

  it('projects local-proof identity while omitting its fixed internal metadata', () => {
    expect(createProviderAssociationSummary({
      environment: 'local',
      provider: 'local-proof',
      providerConclusion: 'success',
      providerRunAttempt: 1,
      providerRunId: 'local-run-25',
      providerStatus: 'completed',
      ref: 'local',
      repository: 'local',
      workflow: 'local-proof',
    })).toEqual({
      provider: 'local-proof',
      providerConclusion: 'success',
      providerRunAttempt: 1,
      providerRunId: 'local-run-25',
      providerStatus: 'completed',
    })
  })

  it('derives a server-owned provider URL from the fixed repository metadata', () => {
    expect(createProviderAssociationSummary({
      environment: 'starye-org',
      providerRunId: '123',
      providerRunAttempt: 2,
      providerStatus: 'completed',
      repository: 'inspire-man/starye',
      ref: 'main',
      workflow: '.github/workflows/daily-movie-crawl.yml',
      sha: 'b'.repeat(40),
    })).toMatchObject({
      environment: 'starye-org',
      providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/123',
      repository: 'inspire-man/starye',
      ref: 'main',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })
    expect(() => createProviderAssociationSummary({
      environment: 'starye-org',
      providerRunId: '123',
      providerRunUrl: 'https://attacker.invalid/callback',
    })).toThrow('provider_summary_invalid')
  })

  it('uses the fixed repository when projecting a numeric provider run', () => {
    expect(createProviderAssociationSummary({
      providerRunId: '456',
      providerStatus: 'completed',
    })).toEqual({
      provider: 'github-actions',
      providerRunId: '456',
      providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/456',
      providerStatus: 'completed',
      repository: 'inspire-man/starye',
    })
  })
})

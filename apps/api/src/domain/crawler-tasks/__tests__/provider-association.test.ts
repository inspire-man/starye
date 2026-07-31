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
      providerStatus: 'completed',
      sha: 'a'.repeat(40),
    })
    expect(() => createProviderAssociationSummary({
      providerRunId: '1',
      token: 'must-not-cross-the-boundary',
    })).toThrow('provider_summary_invalid')
  })
})

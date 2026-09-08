import type { Page } from 'puppeteer-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NameMapper } from '../name-mapper'

function createPage(title: string, body: string): Page {
  return {
    goto: vi.fn(),
    title: vi.fn().mockResolvedValue(title),
    evaluate: vi.fn().mockResolvedValue(body),
  } as unknown as Page
}

function createWiki() {
  return {
    buildActorUrl: (name: string) => `https://wiki.test/actor/${encodeURIComponent(name)}`,
    buildPublisherUrl: (name: string) => `https://wiki.test/publisher/${encodeURIComponent(name)}`,
    fetchActorIndexPage: vi.fn(),
    fetchPublisherIndexPage: vi.fn(),
  } as any
}

describe('name mapper retry and error-page guards', () => {
  let mapper: NameMapper

  beforeEach(() => {
    mapper = new NameMapper(createWiki(), {
      actorMapFile: './.test-actor-map.json',
      publisherMapFile: './.test-publisher-map.json',
      unmappedActorsFile: './.test-unmapped-actors.json',
      unmappedPublishersFile: './.test-unmapped-publishers.json',
    })
  })

  it('does not accept a short or not-found page as an actor mapping', async () => {
    const page = createPage('Wiki', 'short')
    expect(await mapper.matchActorName('Actor A', page)).toBeNull()
    expect(page.goto).toHaveBeenCalled()
  })

  it('does not accept a not-found publisher page', async () => {
    const page = createPage('404 Not Found', 'a'.repeat(200))
    expect(await mapper.matchPublisherName('Studio A', page)).toBeNull()
  })

  it('retries an old unmapped actor after the cooldown', async () => {
    const page = createPage('404', 'missing')
    await mapper.matchActorName('Actor B', page)
    ;(mapper as any).unmappedActors.get('Actor B').lastAttempt = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60
    const retryPage = createPage('Actor B profile', 'valid wiki profile content '.repeat(6))
    expect(await mapper.matchActorName('Actor B', retryPage)).not.toBeNull()
    expect(retryPage.goto).toHaveBeenCalled()
  })
})

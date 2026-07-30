import { describe, expect, it } from 'vitest'
import { createControlledAdapter } from '../controlled-adapter'
import { createTemplateAdapterRegistry } from '../template-adapters'

describe('task runner template registry', () => {
  it('accepts only matching movie and manga snapshots', () => {
    const movie = { execute: async () => ({ contentIds: [] }), templateKey: 'movie' as const }
    const manga = { execute: async () => ({ contentIds: [] }), templateKey: 'manga' as const }
    const registry = createTemplateAdapterRegistry([movie, manga])
    expect(registry.select({ entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 })).toBe(movie)
    expect(() => registry.select({ entrypoint: 'manga-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 })).toThrow('does not match')
  })

  it('keeps the controlled cancellation adapter out of the public registry', async () => {
    const controlled = createControlledAdapter([])
    expect(controlled.templateKey).toBe('movie')
    await expect(controlled.execute({ candidate: {} as never, checkpoint: async () => true, observe: () => {} })).resolves.toEqual({ contentIds: [] })
  })
})

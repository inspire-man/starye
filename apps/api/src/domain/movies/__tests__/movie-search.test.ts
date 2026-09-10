import { describe, expect, it } from 'vitest'
import { MOVIE_SEARCH_TARGETS, movieSearchPattern } from '../movie-search'

describe('movie search', () => {
  it('matches code, title, series, actor and publisher', () => {
    expect(MOVIE_SEARCH_TARGETS).toEqual(['code', 'title', 'series', 'actor', 'publisher'])
    expect(movieSearchPattern('  MUDR  ')).toBe('%MUDR%')
  })
})

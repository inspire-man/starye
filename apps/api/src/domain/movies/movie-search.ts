export const MOVIE_SEARCH_TARGETS = ['code', 'title', 'series', 'actor', 'publisher'] as const

export function movieSearchPattern(search: string): string {
  return `%${search.trim()}%`
}

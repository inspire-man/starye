import { describe, expect, it } from 'vitest'
import { classifyMovieOpsKind } from '../movie-ops'

describe('classifyMovieOpsKind', () => {
  it('maps existing movie crawler operations onto shared ops kinds', () => {
    expect(classifyMovieOpsKind('repair_players', {})).toBe('recheck_players')
    expect(classifyMovieOpsKind('movie', { preparedEntry: 'crawler-backfill-covers' })).toBe('backfill_covers')
    expect(classifyMovieOpsKind('movie', { intent: 'preview-backfill' })).toBe('backfill_previews')
    expect(classifyMovieOpsKind('movie', { intent: 'repair-actor-relations' })).toBe('repair_relations')
    expect(classifyMovieOpsKind('movie', { templateKey: 'movie' })).toBe('sync_metadata')
  })
})

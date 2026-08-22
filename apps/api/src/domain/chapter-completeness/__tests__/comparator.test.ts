import { describe, expect, it } from 'vitest'
import { compareChapterCompleteness } from '../comparator'
import { normalizeSourceChapterRow } from '../identity'
import { buildChapterSourceSnapshot } from '../repository'

function snapshot(rows: Array<{ slug: string, number: number }>, terminalState: 'complete' | 'partial' | 'unavailable' | 'inconclusive' = 'complete') {
  return buildChapterSourceSnapshot({
    comicId: 'comic-1',
    observedAt: 1_700_000_000,
    sourceRows: rows.map((row, sourceOrdinal) => ({
      sourceOrdinal,
      slug: row.slug,
      title: `Chapter ${row.number}`,
      chapterNumber: row.number,
      sourceUrl: `https://source.example/${row.slug}`,
    })),
    terminalState,
  }, 3)
}

describe('chapter completeness comparator', () => {
  it('retains duplicate source identities and reports missing chapters', () => {
    const result = compareChapterCompleteness(snapshot([
      { slug: 'chapter-1', number: 1 },
      { slug: 'chapter-1', number: 1 },
      { slug: 'chapter-3', number: 3 },
    ]), [
      { id: 'comic-1-chapter-1', slug: 'chapter-1', chapterNumber: 1, sortOrder: 1 },
    ])

    expect(result.status).toBe('partial')
    expect(result.counts).toMatchObject({ duplicateIdentityCount: 1, missingCount: 1, sourceCount: 3 })
    expect(result.findings.map(finding => finding.code)).toEqual(expect.arrayContaining(['duplicate', 'missing', 'sequence_gap']))
  })

  it('separates source terminal state from completeness findings', () => {
    const result = compareChapterCompleteness(snapshot([], 'unavailable'), [])
    expect(result.status).toBe('unavailable')
    expect(result.terminalState).toBe('unavailable')
    expect(result.reasonCode).toBe('complete')
  })

  it('detects stored order and extra identities without deleting stored rows', () => {
    const result = compareChapterCompleteness(snapshot([
      { slug: 'chapter-1', number: 1 },
      { slug: 'chapter-2', number: 2 },
    ]), [
      { id: 'extra', slug: 'old', chapterNumber: 0, sortOrder: 0 },
      { id: 'two', slug: 'chapter-2', chapterNumber: 2, sortOrder: 1 },
      { id: 'one', slug: 'chapter-1', chapterNumber: 1, sortOrder: 2 },
    ])
    expect(result.findings.map(finding => finding.code)).toEqual(expect.arrayContaining(['extra', 'order']))
    expect(result.counts.storedCount).toBe(3)
  })

  it('keeps source terminal state separate from a partial completeness result', () => {
    const result = compareChapterCompleteness(snapshot([
      { slug: 'chapter-1', number: 1 },
      { slug: 'chapter-2', number: 2 },
    ]), [
      { id: 'comic-1-chapter-1', slug: 'chapter-1', chapterNumber: 1, sortOrder: 1 },
    ])

    expect(result.status).toBe('partial')
    expect(result.terminalState).toBe('complete')
  })

  it('uses one stable identity when a source row has only a URL', () => {
    const row = normalizeSourceChapterRow({
      sourceOrdinal: 0,
      sourceUrl: 'https://source.example/chapter/1?token=secret',
      title: 'Chapter 1',
    })
    const source = buildChapterSourceSnapshot({
      comicId: 'comic-1',
      observedAt: 1_700_000_000,
      sourceRows: [{
        sourceOrdinal: 0,
        sourceUrl: 'https://source.example/chapter/1?token=secret',
        title: 'Chapter 1',
      }],
      terminalState: 'complete',
    }, 1)
    const result = compareChapterCompleteness(source, [{
      chapterNumber: 1,
      id: `comic-1-${row.slug}`,
      slug: row.slug!,
      sortOrder: 1,
    }])

    expect(row.slug).toMatch(/^url-[0-9a-f]{8}$/u)
    expect(result.counts.missingCount).toBe(0)
    expect(result.counts.extraStoredCount).toBe(0)
  })
})

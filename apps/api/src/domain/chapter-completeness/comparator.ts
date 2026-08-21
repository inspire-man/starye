import type {
  ChapterCompletenessFinding,
  ChapterCompletenessProjection,
  ChapterSourceSnapshot,
  StoredChapterIdentity,
} from './types'
import { storedChapterIdentity } from './identity'
import { MAX_FINDINGS } from './types'

function addFinding(findings: ChapterCompletenessFinding[], finding: ChapterCompletenessFinding): void {
  if (findings.length < MAX_FINDINGS)
    findings.push(finding)
}

function reasonCode(findings: readonly ChapterCompletenessFinding[]): string {
  return findings[0]?.code === 'missing'
    ? 'missing_chapters'
    : findings[0]?.code === 'duplicate'
      ? 'duplicate_source_rows'
      : findings[0]?.code === 'sequence_gap'
        ? 'chapter_sequence_gap'
        : findings[0]?.code === 'order'
          ? 'chapter_order_mismatch'
          : findings[0]?.code === 'extra'
            ? 'stored_extra_chapters'
            : 'complete'
}

export function compareChapterCompleteness(
  snapshot: ChapterSourceSnapshot,
  storedChapters: readonly StoredChapterIdentity[],
  observationIdentity = `chapter-completeness:${snapshot.comicId}:${snapshot.sourceRevision}`,
): ChapterCompletenessProjection {
  const findings: ChapterCompletenessFinding[] = []
  const sourceByIdentity = new Map<string, number[]>()
  for (const row of snapshot.rows) {
    const ordinals = sourceByIdentity.get(row.identity) ?? []
    ordinals.push(row.sourceOrdinal)
    sourceByIdentity.set(row.identity, ordinals)
  }
  const storedByIdentity = new Map<string, StoredChapterIdentity[]>()
  for (const chapter of storedChapters) {
    const identity = storedChapterIdentity(chapter)
    const rows = storedByIdentity.get(identity) ?? []
    rows.push(chapter)
    storedByIdentity.set(identity, rows)
  }

  let missingCount = 0
  for (const [identity, ordinals] of sourceByIdentity) {
    if (!storedByIdentity.has(identity)) {
      missingCount++
      addFinding(findings, {
        code: 'missing',
        detail: 'source chapter is absent from stored chapters',
        identity,
        sourceOrdinals: ordinals.slice(0, 10),
      })
    }
    if (ordinals.length > 1) {
      addFinding(findings, {
        code: 'duplicate',
        detail: 'source contains repeated chapter identity',
        identity,
        sourceOrdinals: ordinals.slice(0, 10),
      })
    }
  }

  let extraStoredCount = 0
  for (const [identity, chapters] of storedByIdentity) {
    if (!sourceByIdentity.has(identity)) {
      extraStoredCount++
      addFinding(findings, {
        code: 'extra',
        detail: 'stored chapter is absent from the latest source snapshot',
        identity,
        storedChapterIds: chapters.map(chapter => chapter.id).slice(0, 10),
      })
    }
  }

  const sourceOrder = [...sourceByIdentity.entries()]
    .sort(([, left], [, right]) => (left[0] ?? 0) - (right[0] ?? 0))
    .map(([identity]) => identity)
  const storedOrder = [...storedByIdentity.entries()]
    .sort(([, left], [, right]) => (left[0]?.sortOrder ?? 0) - (right[0]?.sortOrder ?? 0))
    .map(([identity]) => identity)
  const commonSourceOrder = sourceOrder.filter(identity => storedByIdentity.has(identity))
  const commonStoredOrder = storedOrder.filter(identity => sourceByIdentity.has(identity))
  if (commonSourceOrder.some((identity, index) => identity !== commonStoredOrder[index])) {
    addFinding(findings, {
      code: 'order',
      detail: 'source ordinal order differs from stored chapter order',
    })
  }

  const sourceNumbers = snapshot.rows
    .map(row => row.chapterNumber)
    .filter((value): value is number => value !== null && value !== undefined)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((left, right) => left - right)
  if (sourceNumbers.length > 1) {
    const min = sourceNumbers[0]!
    const max = sourceNumbers.at(-1)!
    const expected = new Set(Array.from({ length: max - min + 1 }, (_, index) => min + index))
    const missingNumbers = [...expected].filter(number => !sourceNumbers.includes(number)).slice(0, 20)
    if (missingNumbers.length > 0) {
      addFinding(findings, {
        code: 'sequence_gap',
        detail: `source chapter number sequence has gaps: ${missingNumbers.join(',')}`,
      })
    }
  }

  const status = snapshot.terminalState !== 'complete'
    ? snapshot.terminalState
    : findings.length === 0 ? 'complete' : 'partial'
  return {
    counts: {
      duplicateIdentityCount: [...sourceByIdentity.values()].filter(rows => rows.length > 1).length,
      extraStoredCount,
      missingCount,
      sourceCount: snapshot.sourceCount,
      storedCount: storedChapters.length,
      uniqueSourceCount: sourceByIdentity.size,
    },
    findings,
    observationIdentity,
    reasonCode: reasonCode(findings),
    sourceRevision: snapshot.sourceRevision,
    status,
    terminalState: snapshot.terminalState,
  }
}

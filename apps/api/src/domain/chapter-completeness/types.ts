export const CHAPTER_COMPLETENESS_POLICY_VERSION = 'chapter-completeness/v1' as const
export const MAX_SOURCE_CHAPTER_ROWS = 5_000 as const
export const MAX_FINDINGS = 100 as const

export type ChapterSourceTerminalState = 'complete' | 'partial' | 'unavailable' | 'inconclusive'
export type ChapterCompletenessStatus = ChapterSourceTerminalState

export interface SourceChapterRowInput {
  readonly chapterNumber?: number | null
  readonly sourceOrdinal: number
  readonly sourceUrl?: string | null
  readonly slug?: string | null
  readonly title: string
}

export interface NormalizedSourceChapterRow extends SourceChapterRowInput {
  readonly identity: string
}

export interface ChapterSourceSnapshotInput {
  readonly comicId: string
  readonly observedAt: number
  readonly sourceRows: readonly SourceChapterRowInput[]
  readonly sourceUrl?: string | null
  readonly terminalState: ChapterSourceTerminalState
}

export interface ChapterSourceSnapshot {
  readonly comicId: string
  readonly observedAt: number
  readonly rowCount: number
  readonly rows: readonly NormalizedSourceChapterRow[]
  readonly snapshotIdentity: string
  readonly sourceFingerprint: string
  readonly sourceCount: number
  readonly sourceRevision: number
  readonly sourceUrl?: string | null
  readonly terminalState: ChapterSourceTerminalState
}

export interface StoredChapterIdentity {
  readonly chapterNumber?: number | null
  readonly id: string
  readonly slug?: string | null
  readonly sortOrder: number
}

export type ChapterCompletenessFindingCode = 'missing' | 'duplicate' | 'extra' | 'order' | 'sequence_gap'

export interface ChapterCompletenessFinding {
  readonly code: ChapterCompletenessFindingCode
  readonly detail: string
  readonly identity?: string
  readonly sourceOrdinals?: readonly number[]
  readonly storedChapterIds?: readonly string[]
}

export interface ChapterCompletenessCounts {
  readonly duplicateIdentityCount: number
  readonly extraStoredCount: number
  readonly missingCount: number
  readonly sourceCount: number
  readonly storedCount: number
  readonly uniqueSourceCount: number
}

export interface ChapterCompletenessProjection {
  readonly counts: ChapterCompletenessCounts
  readonly findings: readonly ChapterCompletenessFinding[]
  readonly observationIdentity: string
  readonly reasonCode: string
  readonly sourceRevision: number
  readonly status: ChapterCompletenessStatus
  readonly terminalState: ChapterSourceTerminalState
}

import type { AdapterExecutionContext, AdapterExecutionResult, TaskRunnerAdapter } from './template-adapters'
import { isChapterPageRunnerSnapshot, isComicChapterRunnerSnapshot } from './runner-client'

interface ChapterObservationClient {
  observeChapterCompleteness?: (candidate: AdapterExecutionContext['candidate'], sequence: number) => Promise<{ accepted: boolean }>
  observeChapterPages?: (candidate: AdapterExecutionContext['candidate'], sequence: number) => Promise<{ accepted: boolean }>
}

export function createChapterAvailabilityAdapter(): TaskRunnerAdapter {
  return {
    templateKey: 'manga',
    async execute(context: AdapterExecutionContext): Promise<AdapterExecutionResult> {
      if (await context.checkpoint())
        return { contentIds: [] }

      const client = context.client as ChapterObservationClient | undefined
      const candidate = context.candidate
      if (isComicChapterRunnerSnapshot(candidate.snapshot)) {
        const response = await client?.observeChapterCompleteness?.(candidate, context.nextSequence?.() ?? candidate.sequence + 1)
        if (!response?.accepted)
          throw new Error('chapter completeness observation rejected')
        context.observe(candidate.snapshot.comicId)
        return { contentIds: [candidate.snapshot.comicId] }
      }
      if (isChapterPageRunnerSnapshot(candidate.snapshot)) {
        const response = await client?.observeChapterPages?.(candidate, context.nextSequence?.() ?? candidate.sequence + 1)
        if (!response?.accepted)
          throw new Error('chapter page observation rejected')
        context.observe(candidate.snapshot.comicId)
        return { contentIds: [candidate.snapshot.comicId] }
      }
      throw new Error('chapter availability adapter received an unrelated snapshot')
    },
  }
}

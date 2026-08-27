import { describe, expect, it, vi } from 'vitest'
import { copyResearchReportMarkdown } from '../research-report-copy'

describe('research report Markdown clipboard', () => {
  it('writes the exact Markdown to the available clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    await expect(copyResearchReportMarkdown('# report', { writeText })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith('# report')
  })

  it('reports unavailable when the browser has no clipboard writer', async () => {
    await expect(copyResearchReportMarkdown('# report', undefined)).resolves.toBe('unavailable')
  })

  it('reports a rejected clipboard write without throwing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'))

    await expect(copyResearchReportMarkdown('# report', { writeText })).resolves.toBe('failed')
  })
})

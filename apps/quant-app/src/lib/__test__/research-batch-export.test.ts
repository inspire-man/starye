import type { QuantResearchRun } from '../quant-types'
import { describe, expect, it, vi } from 'vitest'
import { buildResearchBatchFilename, buildResearchBatchMarkdown } from '../research-batch-export'
import { copyResearchReportMarkdown } from '../research-report-copy'

function researchRun(tsCode: string, generatedAt = '2026-08-28T08:00:00.000Z'): QuantResearchRun {
  return {
    id: `run-${tsCode}`,
    tsCode,
    name: `股票 ${tsCode}`,
    reportVersion: 'research-report-v2',
    sourceSnapshotId: 'snapshot-1',
    generatedAt,
    createdAt: generatedAt,
    status: 'ready',
    report: {
      reportVersion: 'research-report-v2',
      tsCode,
      name: `股票 ${tsCode}`,
      generatedAt,
      sourceSnapshotId: 'snapshot-1',
      status: 'ready',
      action: 'research-window',
      score: 80,
      headline: `研究 ${tsCode}`,
      strengths: ['估值可用'],
      risks: [],
      gaps: [],
      nextActions: ['继续核对'],
      evidence: [],
      sources: [],
    },
  }
}

describe('research batch Markdown export', () => {
  it('keeps successful report order and makes partial failures explicit', () => {
    const markdown = buildResearchBatchMarkdown([researchRun('B'), researchRun('A')], ['C'])

    expect(markdown).toContain('# Quant 批量研究报告')
    expect(markdown).toContain('成功报告：2')
    expect(markdown).toContain('失败项目：1')
    expect(markdown).toContain('失败股票：C')
    expect(markdown.indexOf('股票 B（B）')).toBeLessThan(markdown.indexOf('股票 A（A）'))
    expect(markdown).toContain('## 第 1 份研究报告')
    expect(markdown).toContain('## 第 2 份研究报告')
  })

  it('deduplicates repeated stock runs and returns no document for empty input', () => {
    const markdown = buildResearchBatchMarkdown([researchRun('A'), researchRun('A')], ['A', 'B'])

    expect(markdown).toContain('成功报告：1')
    expect(markdown).toContain('失败股票：B')
    expect(markdown).not.toContain('失败股票：A')
    expect(buildResearchBatchMarkdown([], ['A'])).toBe('')
  })

  it('keeps report fields allowlisted and builds a date-based filename', () => {
    const run = {
      ...researchRun('A'),
      token: 'TOKEN',
      report: { ...researchRun('A').report, apiKey: 'API_KEY' },
    } as QuantResearchRun & { token: string, report: QuantResearchRun['report'] & { apiKey: string } }

    const markdown = buildResearchBatchMarkdown([run])

    expect(markdown).not.toContain('TOKEN')
    expect(markdown).not.toContain('API_KEY')
    expect(buildResearchBatchFilename([run])).toBe('quant-research-batch-2026-08-28.md')
    expect(buildResearchBatchFilename([])).toBe('quant-research-batch-unknown-date.md')
  })

  it('passes the stable Markdown payload to the clipboard unchanged', async () => {
    const markdown = buildResearchBatchMarkdown([researchRun('A')], ['B'])
    const writeText = vi.fn().mockResolvedValue(undefined)

    await expect(copyResearchReportMarkdown(markdown, { writeText })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith(buildResearchBatchMarkdown([researchRun('A')], ['B']))
  })
})

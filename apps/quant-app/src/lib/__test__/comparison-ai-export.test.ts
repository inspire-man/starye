import type { QuantResearchComparison } from '../quant-view-models'
import { describe, expect, it, vi } from 'vitest'
import { buildResearchComparisonFilename, buildResearchComparisonMarkdown } from '../comparison-ai-export'
import { copyResearchReportMarkdown } from '../research-report-copy'

function comparison(): QuantResearchComparison {
  return {
    comparisonVersion: 'research-comparison-v1',
    provider: 'openai_compatible',
    model: 'gpt-5.4',
    generatedAt: '2026-08-29T08:00:00.000Z',
    overview: '两份报告都需要结合报告期和证据状态继续核对。',
    commonGround: ['共同保持数据边界', '都需要人工复核'],
    differences: [{
      tsCode: '601899.SH',
      point: '当前报告的价值质量更完整。',
      evidenceKeys: ['value.score', 'value.status'],
    }],
    risks: ['报告期不同，不做强行横比。'],
    nextChecks: ['核对最近报告期'],
    citedEvidence: [{ tsCode: '601899.SH', evidenceKey: 'value.score' }],
  }
}

describe('research comparison Markdown export', () => {
  it('serializes the allowlisted comparison sections in source order', () => {
    const markdown = buildResearchComparisonMarkdown(comparison())

    expect(markdown).toContain('# Quant AI 对比研究')
    expect(markdown).toContain('对比版本：research-comparison-v1')
    expect(markdown).toContain('共同点')
    expect(markdown).toContain('关键差异')
    expect(markdown).toContain('601899.SH')
    expect(markdown).toContain('value.score、value.status')
    expect(markdown).toContain('风险')
    expect(markdown).toContain('下一步核对')
    expect(markdown).toContain('引用证据')
    expect(markdown.indexOf('## 共同点')).toBeLessThan(markdown.indexOf('## 关键差异'))
    expect(markdown.indexOf('## 关键差异')).toBeLessThan(markdown.indexOf('## 风险'))
  })

  it('keeps empty collections explicit and strips unknown fields', () => {
    const value = {
      ...comparison(),
      commonGround: [],
      differences: [],
      risks: [],
      nextChecks: [],
      citedEvidence: [],
      token: 'TOKEN',
      nested: { secret: 'SECRET' },
    } as QuantResearchComparison & { token: string, nested: { secret: string } }
    const markdown = buildResearchComparisonMarkdown(value)

    expect(markdown).toContain('- 暂无记录')
    expect(markdown).toContain('- 暂无关键差异')
    expect(markdown).toContain('- 暂无引用证据')
    expect(markdown).not.toContain('TOKEN')
    expect(markdown).not.toContain('SECRET')
  })

  it('normalizes long text line breaks and builds a date-based filename', () => {
    const value = { ...comparison(), overview: '第一行\n第二行' }
    const markdown = buildResearchComparisonMarkdown(value)

    expect(markdown).toContain('第一行 第二行')
    expect(markdown).not.toContain('第一行\n第二行')
    expect(buildResearchComparisonFilename(value)).toBe('quant-research-comparison-2026-08-29.md')
    expect(buildResearchComparisonFilename({ ...value, generatedAt: '' })).toBe('quant-research-comparison-unknown-date.md')
  })

  it('uses the same formatted payload for clipboard copy', async () => {
    const value = comparison()
    const writeText = vi.fn().mockResolvedValue(undefined)

    await expect(copyResearchReportMarkdown(buildResearchComparisonMarkdown(value), { writeText })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith(buildResearchComparisonMarkdown(value))
  })
})

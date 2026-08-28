import type { QuantAiCandidateBriefing } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildCandidateAiBriefingFilename, buildCandidateAiBriefingMarkdown } from '../candidate-briefing-export'

function briefing(overrides: Partial<QuantAiCandidateBriefing> = {}): QuantAiCandidateBriefing {
  return {
    briefingVersion: 'candidate-briefing-v1',
    provider: 'openai_compatible',
    model: 'gpt-5.4',
    generatedAt: '2026-08-29T03:00:00.000Z',
    overview: '先核对研究标记，再检查数据完整性。',
    focusItems: [{
      tsCode: '601899.SH',
      name: '紫金矿业',
      priorityLevel: 'high',
      priorityScore: 72,
      actionLabel: '核对风险',
      reasons: ['近日日线回撤达到 3%'],
      explanation: '先回看风险事实。',
    }],
    nextChecks: ['核对数据截至日期'],
    citedCandidateCodes: ['601899.SH'],
    ...overrides,
  }
}

describe('candidate AI briefing Markdown export', () => {
  it('keeps briefing metadata, deterministic focus facts, checks and citations', () => {
    const markdown = buildCandidateAiBriefingMarkdown(briefing(), 14)

    expect(markdown).toContain('# Quant AI 候选简报')
    expect(markdown).toContain('简报版本：candidate-briefing-v1')
    expect(markdown).toContain('当前候选：14 个')
    expect(markdown).toContain('紫金矿业（601899.SH）')
    expect(markdown).toContain('优先级：高优先（high）')
    expect(markdown).toContain('优先级分数：72.0')
    expect(markdown).toContain('触发原因：\n- 近日日线回撤达到 3%')
    expect(markdown).toContain('核对数据截至日期')
    expect(markdown).toContain('- 601899.SH')
    expect(buildCandidateAiBriefingFilename(briefing())).toBe('quant-candidate-briefing-2026-08-29.md')
  })

  it('keeps empty values explicit and normalizes multiline text', () => {
    const markdown = buildCandidateAiBriefingMarkdown(briefing({
      generatedAt: 'invalid-date',
      overview: '第一句\n第二句',
      focusItems: [{
        ...briefing().focusItems[0],
        name: null,
        reasons: [],
        explanation: '第一行\r\n第二行',
      }],
      nextChecks: [],
      citedCandidateCodes: [],
    }), Number.NaN)

    expect(markdown).toContain('生成时间：invalid-date')
    expect(markdown).toContain('第一句 第二句')
    expect(markdown).toContain('名称待补齐')
    expect(markdown).toContain('- 触发原因：\n- 暂无记录')
    expect(markdown).toContain('第一行 第二行')
    expect(markdown).toContain('## 下一步核对\n\n- 暂无记录')
    expect(markdown).toContain('## 引用候选代码\n\n- 暂无记录')
    expect(buildCandidateAiBriefingFilename(briefing({ generatedAt: 'invalid-date' }))).toBe('quant-candidate-briefing-unknown-date.md')
  })

  it('serializes only the allowlisted briefing fields', () => {
    const value = {
      ...briefing(),
      apiKey: 'API_KEY',
      token: 'TOKEN',
      focusItems: [{ ...briefing().focusItems[0], internalNote: 'INTERNAL_NOTE' }],
    } as QuantAiCandidateBriefing & { apiKey: string, token: string, focusItems: Array<QuantAiCandidateBriefing['focusItems'][number] & { internalNote: string }> }

    const markdown = buildCandidateAiBriefingMarkdown(value, 1)

    expect(markdown).not.toContain('API_KEY')
    expect(markdown).not.toContain('TOKEN')
    expect(markdown).not.toContain('INTERNAL_NOTE')
  })
})

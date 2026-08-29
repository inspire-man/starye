import { describe, expect, it } from 'vitest'
import { buildResearchSummaryNextCheckPrompt } from '../research-summary-prompts'

describe('research summary next-check prompts', () => {
  it('builds a report-scoped prompt and ignores surrounding whitespace', () => {
    expect(buildResearchSummaryNextCheckPrompt('  等待下一期报告  ')).toBe('围绕单股研究摘要核对项“等待下一期报告”，当前研究报告中有哪些确定性事实需要优先核对？')
  })

  it('returns empty for a blank check and preserves the fixed suffix for long text', () => {
    expect(buildResearchSummaryNextCheckPrompt('  ')).toBe('')

    const prompt = buildResearchSummaryNextCheckPrompt('核对'.repeat(400))
    expect(prompt.length).toBe(500)
    expect(prompt).toContain('当前研究报告中有哪些确定性事实')
    expect(prompt.endsWith('需要优先核对？')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { buildResearchChangeNextCheckPrompt } from '../research-change-prompts'

describe('research change next-check prompts', () => {
  it('builds a report-scoped prompt and ignores surrounding whitespace', () => {
    expect(buildResearchChangeNextCheckPrompt('  核对趋势样本  ')).toBe('围绕研究变化核对项“核对趋势样本”，当前报告问答中有哪些确定性事实需要优先核对？')
  })

  it('returns empty for a blank check and preserves the fixed suffix for long text', () => {
    expect(buildResearchChangeNextCheckPrompt('  ')).toBe('')

    const prompt = buildResearchChangeNextCheckPrompt('变化'.repeat(400))
    expect(prompt.length).toBe(500)
    expect(prompt).toContain('当前报告问答中有哪些确定性事实')
    expect(prompt.endsWith('需要优先核对？')).toBe(true)
  })
})

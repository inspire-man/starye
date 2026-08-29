import { describe, expect, it } from 'vitest'
import { buildComparisonAiNextCheckPrompt } from '../comparison-ai-prompts'

describe('comparison AI next-check prompts', () => {
  it('builds a scoped prompt and ignores surrounding whitespace', () => {
    expect(buildComparisonAiNextCheckPrompt('  核对报告期差异  ')).toBe('围绕对比研究核对项“核对报告期差异”，当前候选范围内涉及的确定性事实有哪些，应该优先核对哪些字段？')
  })

  it('returns empty for a blank check and preserves the fixed suffix for long text', () => {
    expect(buildComparisonAiNextCheckPrompt('  ')).toBe('')

    const prompt = buildComparisonAiNextCheckPrompt('核对'.repeat(400))
    expect(prompt.length).toBe(500)
    expect(prompt).toContain('当前候选范围内涉及的确定性事实有哪些')
    expect(prompt.endsWith('应该优先核对哪些字段？')).toBe(true)
  })
})

const MAX_QUESTION_LENGTH = 500

export function buildComparisonAiNextCheckPrompt(check: string): string {
  const normalized = check.trim()
  if (!normalized)
    return ''

  const prefix = '围绕对比研究核对项“'
  const suffix = '”，当前候选范围内涉及的确定性事实有哪些，应该优先核对哪些字段？'
  const maxCheckLength = Math.max(0, MAX_QUESTION_LENGTH - prefix.length - suffix.length)
  return `${prefix}${normalized.slice(0, maxCheckLength)}${suffix}`
}

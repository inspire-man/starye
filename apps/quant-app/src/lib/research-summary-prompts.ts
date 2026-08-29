const MAX_QUESTION_LENGTH = 500

export function buildResearchSummaryNextCheckPrompt(check: string): string {
  const normalized = check.trim()
  if (!normalized)
    return ''

  const prefix = '围绕单股研究摘要核对项“'
  const suffix = '”，当前研究报告中有哪些确定性事实需要优先核对？'
  const maxCheckLength = Math.max(0, MAX_QUESTION_LENGTH - prefix.length - suffix.length)
  return `${prefix}${normalized.slice(0, maxCheckLength)}${suffix}`
}

const MAX_QUESTION_LENGTH = 500

export function buildResearchChangeNextCheckPrompt(check: string): string {
  const normalized = check.trim()
  if (!normalized)
    return ''

  const prefix = '围绕研究变化核对项“'
  const suffix = '”，当前报告问答中有哪些确定性事实需要优先核对？'
  const maxCheckLength = Math.max(0, MAX_QUESTION_LENGTH - prefix.length - suffix.length)
  return `${prefix}${normalized.slice(0, maxCheckLength)}${suffix}`
}

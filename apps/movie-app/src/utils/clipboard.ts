/**
 * 复制文本到剪贴板
 * 优先使用 Clipboard API，失败则降级到 execCommand
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // 降级方案：使用 execCommand (已废弃但兼容性好)
    return fallbackCopyToClipboard(text)
  }
  catch (error) {
    console.warn('Clipboard API 失败，尝试降级方案', error)
    return fallbackCopyToClipboard(text)
  }
}

/**
 * 降级复制方案（使用 textarea + execCommand）
 */
function fallbackCopyToClipboard(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)

    textarea.select()
    textarea.setSelectionRange(0, text.length)

    const success = document.execCommand('copy')
    document.body.removeChild(textarea)

    return success
  }
  catch (error) {
    console.error('降级复制方案失败', error)
    return false
  }
}

/**
 * 批量复制磁链（换行符分隔）
 */
export async function copyMagnetLinks(links: Array<{ sourceName: string, sourceUrl: string, quality?: string }>): Promise<boolean> {
  const formattedLinks = links.map((link) => {
    const qualityLabel = link.quality ? `[${link.quality}]` : ''
    return `${qualityLabel} ${link.sourceName}\n${link.sourceUrl}`
  }).join('\n\n')

  return copyToClipboard(formattedLinks)
}

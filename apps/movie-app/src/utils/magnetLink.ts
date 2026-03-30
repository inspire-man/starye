/**
 * 验证磁力链接格式是否合法
 */
export function validateMagnetLink(url: string): boolean {
  if (!url)
    return false

  // 标准磁力链接格式：magnet:?xt=urn:btih:...
  // 支持32-40位的infohash（SHA1为40位，短hash为32位）
  const magnetRegex = /^magnet:\?xt=urn:btih:[a-fA-F0-9]{32,40}(?:&.*)?$/

  return magnetRegex.test(url)
}

/**
 * 检查是否为磁力链接（不验证格式完整性）
 */
export function isMagnetLink(url: string): boolean {
  return url?.startsWith('magnet:') || false
}

/**
 * 从URL中提取infohash（如果是磁力链接）
 */
export function extractInfoHash(url: string): string | null {
  if (!isMagnetLink(url))
    return null

  const match = url.match(/urn:btih:([a-f0-9]{32,40})/i)
  return match ? match[1] : null
}

/**
 * 格式化磁力链接显示文本（截取infohash前8位）
 */
export function formatMagnetDisplay(url: string): string {
  const hash = extractInfoHash(url)
  if (!hash)
    return url

  return `magnet:...${hash.substring(0, 8)}`
}

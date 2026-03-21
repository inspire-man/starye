/**
 * 将 Unix 时间戳格式化为完整日期时间字符串
 * @param timestamp Unix 时间戳（秒）
 * @returns 格式化的日期时间字符串，如 "2026-03-21 14:23:18"，无效时返回 "-"
 */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp)
    return '-'

  const date = new Date(timestamp * 1000)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 将 Unix 时间戳格式化为日期字符串（不含时间）
 * @param timestamp Unix 时间戳（秒）
 * @returns 格式化的日期字符串，如 "2026-03-21"，无效时返回 "-"
 */
export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp)
    return '-'

  const date = new Date(timestamp * 1000)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

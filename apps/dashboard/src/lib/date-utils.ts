/**
 * 将时间戳格式化为完整日期时间字符串
 * @param timestamp Unix 时间戳（秒或毫秒）、ISO 字符串、或 Date 对象
 * @returns 格式化的日期时间字符串，如 "2026-03-21 14:23:18"，无效时返回 "-"
 */
export function formatDateTime(timestamp: number | string | Date | null | undefined): string {
  if (!timestamp)
    return '-'

  let date: Date

  if (typeof timestamp === 'string') {
    // ISO 字符串
    date = new Date(timestamp)
  }
  else if (timestamp instanceof Date) {
    // Date 对象
    date = timestamp
  }
  else if (typeof timestamp === 'number') {
    // 时间戳：如果大于 10 位数字，认为是毫秒；否则是秒
    date = timestamp > 9999999999 ? new Date(timestamp) : new Date(timestamp * 1000)
  }
  else {
    return '-'
  }

  // 验证日期有效性
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 将时间戳格式化为日期字符串（不含时间）
 * @param timestamp Unix 时间戳（秒或毫秒）、ISO 字符串、或 Date 对象
 * @returns 格式化的日期字符串，如 "2026-03-21"，无效时返回 "-"
 */
export function formatDate(timestamp: number | string | Date | null | undefined): string {
  if (!timestamp)
    return '-'

  let date: Date

  if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  }
  else if (timestamp instanceof Date) {
    date = timestamp
  }
  else if (typeof timestamp === 'number') {
    date = timestamp > 9999999999 ? new Date(timestamp) : new Date(timestamp * 1000)
  }
  else {
    return '-'
  }

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

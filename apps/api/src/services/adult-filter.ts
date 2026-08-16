import type { SessionUser } from '../types'
import { eq } from 'drizzle-orm'

// 支持所有含 isR18 列的表（movies / comics / actors / publishers）
// 使用结构类型而非 union，避免导入所有表类型
interface TableWithR18 { isR18: any }

/**
 * 构造成人内容可见性 WHERE 条件。
 * 公开内容访问只由账号的成人内容验证状态决定，管理角色不自动获得 R18 内容可见性。
 *
 * @param user 当前用户（undefined 表示匿名）
 * @param table 含 isR18 列的 Drizzle 表对象
 * @returns Drizzle SQL 条件（push 进 conditions[]），或 undefined（无需过滤）
 */
export function buildAdultVisibilityCondition(
  user: SessionUser | undefined,
  table: TableWithR18,
) {
  if (user?.isR18Verified) {
    return undefined
  }
  return eq(table.isR18, false)
}

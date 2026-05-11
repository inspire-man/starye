import type { SessionUser } from '../types'
import { eq } from 'drizzle-orm'

// 支持所有含 isR18 列的表（movies / comics / actors / publishers）
// 使用结构类型而非 union，避免导入所有表类型
interface TableWithR18 { isR18: any }

/**
 * 构造成人内容可见性 WHERE 条件。
 * 与 checkUserAdultStatus 语义对齐：admin/super_admin 角色或 isR18Verified=true 可见全部。
 *
 * @param user 当前用户（undefined 表示匿名）
 * @param table 含 isR18 列的 Drizzle 表对象
 * @returns Drizzle SQL 条件（push 进 conditions[]），或 undefined（无需过滤）
 */
export function buildAdultVisibilityCondition(
  user: SessionUser | undefined,
  table: TableWithR18,
) {
  // 对齐 checkUserAdultStatus：admin/super_admin 角色也可见 R18（D-07）
  if (user?.isR18Verified || user?.role === 'admin' || user?.role === 'super_admin') {
    return undefined
  }
  return eq(table.isR18, false)
}

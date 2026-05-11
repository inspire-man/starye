/**
 * adult-filter.ts 单元测试
 * 覆盖：ACCESS-04（匿名用户可访问公开目录）、ACCESS-07（匿名用户 list 不含 isR18=true）
 */
import { describe, expect, it } from 'vitest'
import { buildAdultVisibilityCondition } from '../adult-filter'

// 模拟含 isR18 列的表对象（与 Drizzle 表结构兼容）
const mockTable = { isR18: { name: 'isR18' } as any }

describe('buildAdultVisibilityCondition', () => {
  it('未登录用户（undefined）返回过滤条件', () => {
    const cond = buildAdultVisibilityCondition(undefined, mockTable)
    expect(cond).toBeDefined()
  })

  it('isR18Verified=false 的用户返回过滤条件', () => {
    const user = { isR18Verified: false, role: 'user' } as any
    const cond = buildAdultVisibilityCondition(user, mockTable)
    expect(cond).toBeDefined()
  })

  it('isR18Verified=true 的用户返回 undefined（无过滤）', () => {
    const user = { isR18Verified: true, role: 'user' } as any
    const cond = buildAdultVisibilityCondition(user, mockTable)
    expect(cond).toBeUndefined()
  })

  it('admin 角色返回 undefined（无过滤，与 checkUserAdultStatus 对齐）', () => {
    const user = { isR18Verified: false, role: 'admin' } as any
    const cond = buildAdultVisibilityCondition(user, mockTable)
    expect(cond).toBeUndefined()
  })

  it('super_admin 角色返回 undefined（无过滤）', () => {
    const user = { isR18Verified: false, role: 'super_admin' } as any
    const cond = buildAdultVisibilityCondition(user, mockTable)
    expect(cond).toBeUndefined()
  })

  it('返回的条件可以 push 进 conditions 数组', () => {
    const conditions: any[] = []
    const cond = buildAdultVisibilityCondition(undefined, mockTable)
    if (cond)
      conditions.push(cond)
    expect(conditions).toHaveLength(1)
  })
})

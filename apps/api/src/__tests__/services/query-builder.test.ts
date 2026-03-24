import { sql } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { FilterBuilder, paginate } from '../../services/query-builder'

describe('filterBuilder', () => {
  const mockColumn = { name: 'testColumn' }

  describe('eq method', () => {
    it('应该在值不为 undefined 时添加等值条件', () => {
      const builder = new FilterBuilder()
      builder.eq(mockColumn, 'test-value')
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该忽略 undefined 值', () => {
      const builder = new FilterBuilder()
      builder.eq(mockColumn, undefined)
      const result = builder.build()
      expect(result).toBeUndefined()
    })

    it('应该忽略 null 值', () => {
      const builder = new FilterBuilder()
      builder.eq(mockColumn, null)
      const result = builder.build()
      expect(result).toBeUndefined()
    })

    it('应该支持链式调用', () => {
      const builder = new FilterBuilder()
      const result = builder.eq(mockColumn, 'value1').eq(mockColumn, 'value2')
      expect(result).toBe(builder)
    })
  })

  describe('like method', () => {
    it('应该在值非空时添加模糊匹配条件', () => {
      const builder = new FilterBuilder()
      builder.like(mockColumn, 'search')
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该忽略空字符串', () => {
      const builder = new FilterBuilder()
      builder.like(mockColumn, '')
      const result = builder.build()
      expect(result).toBeUndefined()
    })

    it('应该忽略只包含空格的字符串', () => {
      const builder = new FilterBuilder()
      builder.like(mockColumn, '   ')
      const result = builder.build()
      expect(result).toBeUndefined()
    })

    it('应该忽略 undefined', () => {
      const builder = new FilterBuilder()
      builder.like(mockColumn, undefined)
      const result = builder.build()
      expect(result).toBeUndefined()
    })
  })

  describe('between method', () => {
    it('应该在提供 min 时添加 gte 条件', () => {
      const builder = new FilterBuilder()
      builder.between(mockColumn, 10, undefined)
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该在提供 max 时添加 lte 条件', () => {
      const builder = new FilterBuilder()
      builder.between(mockColumn, undefined, 100)
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该在提供 min 和 max 时添加两个条件', () => {
      const builder = new FilterBuilder()
      builder.between(mockColumn, 10, 100)
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该在没有提供任何值时返回 undefined', () => {
      const builder = new FilterBuilder()
      builder.between(mockColumn, undefined, undefined)
      const result = builder.build()
      expect(result).toBeUndefined()
    })
  })

  describe('jsonContains method', () => {
    it('应该在值非空时添加 JSON 包含条件', () => {
      const builder = new FilterBuilder()
      builder.jsonContains(mockColumn, 'tag')
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该忽略空字符串', () => {
      const builder = new FilterBuilder()
      builder.jsonContains(mockColumn, '')
      const result = builder.build()
      expect(result).toBeUndefined()
    })
  })

  describe('custom method', () => {
    it('应该在提供 SQL 表达式时添加自定义条件', () => {
      const builder = new FilterBuilder()
      const customSql = sql`custom condition`
      builder.custom(customSql)
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该忽略 undefined', () => {
      const builder = new FilterBuilder()
      builder.custom(undefined)
      const result = builder.build()
      expect(result).toBeUndefined()
    })
  })

  describe('build method', () => {
    it('应该在没有条件时返回 undefined', () => {
      const builder = new FilterBuilder()
      const result = builder.build()
      expect(result).toBeUndefined()
    })

    it('应该在有条件时返回 SQL 对象', () => {
      const builder = new FilterBuilder()
      builder.eq(mockColumn, 'value')
      const result = builder.build()
      expect(result).toBeDefined()
    })

    it('应该组合多个条件', () => {
      const builder = new FilterBuilder()
      builder
        .eq(mockColumn, 'value1')
        .like(mockColumn, 'search')
        .between(mockColumn, 10, 100)
      const result = builder.build()
      expect(result).toBeDefined()
    })
  })
})

describe('paginate', () => {
  it('应该应用默认分页参数', () => {
    const mockQuery = {
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    }

    paginate(mockQuery)

    expect(mockQuery.limit).toHaveBeenCalledWith(20)
    expect(mockQuery.offset).toHaveBeenCalledWith(0)
  })

  it('应该正确计算第 2 页的 offset', () => {
    const mockQuery = {
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    }

    paginate(mockQuery, { page: 2, pageSize: 20 })

    expect(mockQuery.limit).toHaveBeenCalledWith(20)
    expect(mockQuery.offset).toHaveBeenCalledWith(20)
  })

  it('应该支持自定义 pageSize', () => {
    const mockQuery = {
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    }

    paginate(mockQuery, { page: 3, pageSize: 50 })

    expect(mockQuery.limit).toHaveBeenCalledWith(50)
    expect(mockQuery.offset).toHaveBeenCalledWith(100)
  })

  it('应该返回 query 对象以支持链式调用', () => {
    const mockQuery = {
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    }

    const result = paginate(mockQuery, { page: 1 })

    expect(result).toBe(mockQuery)
  })
})

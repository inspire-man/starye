import type { SQL } from 'drizzle-orm'
import { and, eq, gte, ilike, lte, sql } from 'drizzle-orm'

export class FilterBuilder {
  private filters: SQL[] = []

  eq<T>(column: any, value?: T): this {
    if (value !== undefined && value !== null) {
      this.filters.push(eq(column, value))
    }
    return this
  }

  like(column: any, value?: string): this {
    if (value && value.trim()) {
      this.filters.push(ilike(column, `%${value}%`))
    }
    return this
  }

  between(column: any, min?: number, max?: number): this {
    if (min !== undefined && min !== null) {
      this.filters.push(gte(column, min))
    }
    if (max !== undefined && max !== null) {
      this.filters.push(lte(column, max))
    }
    return this
  }

  jsonContains(column: any, value?: string): this {
    if (value && value.trim()) {
      this.filters.push(sql`${column} LIKE '%${sql.raw(value)}%'`)
    }
    return this
  }

  custom(sqlExpression?: SQL): this {
    if (sqlExpression) {
      this.filters.push(sqlExpression)
    }
    return this
  }

  build(): SQL | undefined {
    return this.filters.length > 0 ? and(...this.filters) : undefined
  }
}

export interface PaginationOptions {
  page?: number
  pageSize?: number
}

export function paginate<T extends { limit: (n: number) => T, offset: (n: number) => T }>(
  query: T,
  options: PaginationOptions = {},
): T {
  const { page = 1, pageSize = 20 } = options
  const offset = (page - 1) * pageSize
  return query.limit(pageSize).offset(offset)
}

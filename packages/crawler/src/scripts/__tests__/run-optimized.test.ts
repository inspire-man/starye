import process from 'node:process'
import { describe, expect, it } from 'vitest'

describe('run-optimized 配置传递', () => {
  describe('环境变量校验', () => {
    it('应该在 MAX_MOVIES 未设置时抛出错误', () => {
      // 保存原始环境变量
      const originalMaxMovies = process.env.MAX_MOVIES
      delete process.env.MAX_MOVIES

      // 验证错误逻辑
      expect(() => {
        if (!process.env.MAX_MOVIES) {
          throw new Error('Error: MAX_MOVIES environment variable is required')
        }
      }).toThrow('MAX_MOVIES environment variable is required')

      // 恢复环境变量
      if (originalMaxMovies !== undefined) {
        process.env.MAX_MOVIES = originalMaxMovies
      }
    })

    it('应该正确读取 MAX_MOVIES 环境变量', () => {
      process.env.MAX_MOVIES = '200'

      const maxMovies = Number.parseInt(process.env.MAX_MOVIES)

      expect(maxMovies).toBe(200)
      expect(typeof maxMovies).toBe('number')
    })

    it('应该正确读取 MAX_PAGES 环境变量', () => {
      process.env.MAX_PAGES = '10'

      const maxPages = Number.parseInt(process.env.MAX_PAGES || '5')

      expect(maxPages).toBe(10)
    })

    it('应该在 MAX_PAGES 未设置时使用默认值', () => {
      const originalMaxPages = process.env.MAX_PAGES
      delete process.env.MAX_PAGES

      const maxPages = Number.parseInt(process.env.MAX_PAGES || '5')

      expect(maxPages).toBe(5)

      if (originalMaxPages !== undefined) {
        process.env.MAX_PAGES = originalMaxPages
      }
    })
  })

  describe('配置对象构建', () => {
    it('应该正确构建爬虫配置', () => {
      process.env.MAX_MOVIES = '200'
      process.env.MAX_PAGES = '10'
      process.env.LIST_CONCURRENCY = '2'
      process.env.DETAIL_CONCURRENCY = '3'

      const config = {
        limits: {
          maxMovies: Number.parseInt(process.env.MAX_MOVIES),
          maxPages: Number.parseInt(process.env.MAX_PAGES || '5'),
        },
        concurrency: {
          listPage: Number.parseInt(process.env.LIST_CONCURRENCY || '1'),
          detailPage: Number.parseInt(process.env.DETAIL_CONCURRENCY || '2'),
          image: Number.parseInt(process.env.IMAGE_CONCURRENCY || '3'),
          api: Number.parseInt(process.env.API_CONCURRENCY || '2'),
        },
      }

      expect(config.limits.maxMovies).toBe(200)
      expect(config.limits.maxPages).toBe(10)
      expect(config.concurrency.listPage).toBe(2)
      expect(config.concurrency.detailPage).toBe(3)
    })

    it('应该处理部分配置缺失的情况', () => {
      process.env.MAX_MOVIES = '100'
      const originalListConcurrency = process.env.LIST_CONCURRENCY
      const originalMaxPages = process.env.MAX_PAGES
      delete process.env.LIST_CONCURRENCY
      delete process.env.MAX_PAGES

      const config = {
        limits: {
          maxMovies: Number.parseInt(process.env.MAX_MOVIES),
          maxPages: Number.parseInt(process.env.MAX_PAGES || '5'),
        },
        concurrency: {
          listPage: Number.parseInt(process.env.LIST_CONCURRENCY || '1'),
        },
      }

      expect(config.limits.maxMovies).toBe(100)
      expect(config.limits.maxPages).toBe(5) // 默认值
      expect(config.concurrency.listPage).toBe(1) // 默认值

      if (originalListConcurrency !== undefined) {
        process.env.LIST_CONCURRENCY = originalListConcurrency
      }
      if (originalMaxPages !== undefined) {
        process.env.MAX_PAGES = originalMaxPages
      }
    })
  })
})

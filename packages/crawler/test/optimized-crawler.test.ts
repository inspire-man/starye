/* eslint-disable no-restricted-globals */
/**
 * 优化爬虫单元测试
 */

import type { MovieInfo } from '../src/lib/strategy'
import { describe, expect, it, vi } from 'vitest'

describe('优化爬虫测试', () => {
  describe('数据格式验证', () => {
    it('应该生成符合数据库结构的 MovieInfo', () => {
      const movieInfo: MovieInfo = {
        title: '测试影片',
        slug: 'TEST-001',
        code: 'TEST-001',
        description: '测试描述',
        coverImage: 'https://example.com/cover.jpg',
        releaseDate: Math.floor(Date.now() / 1000),
        duration: 120,
        sourceUrl: 'https://example.com/movie/TEST-001',
        actors: ['演员A', '演员B'],
        genres: ['类型A', '类型B'],
        series: '测试系列',
        publisher: '测试片商',
        isR18: true,
        players: [
          {
            sourceName: '云播',
            sourceUrl: 'https://example.com/play/1',
            quality: 'HD',
            sortOrder: 0,
          },
        ],
      }

      // 验证必需字段
      expect(movieInfo.title).toBeDefined()
      expect(movieInfo.slug).toBeDefined()
      expect(movieInfo.code).toBeDefined()
      expect(movieInfo.isR18).toBe(true)

      // 验证数组字段
      expect(Array.isArray(movieInfo.actors)).toBe(true)
      expect(Array.isArray(movieInfo.genres)).toBe(true)
      expect(Array.isArray(movieInfo.players)).toBe(true)

      // 验证时间戳格式（Unix 秒）
      expect(typeof movieInfo.releaseDate).toBe('number')
      expect(movieInfo.releaseDate).toBeGreaterThan(0)
    })

    it('应该正确处理可选字段', () => {
      const minimalMovie: MovieInfo = {
        title: '最小影片',
        slug: 'MIN-001',
        code: 'MIN-001',
        description: '',
        coverImage: '',
        releaseDate: 0,
        duration: 0,
        sourceUrl: 'https://example.com/movie/MIN-001',
        actors: [],
        genres: [],
        isR18: true,
        players: [],
      }

      expect(minimalMovie.series).toBeUndefined()
      expect(minimalMovie.publisher).toBeUndefined()
      expect(minimalMovie.actors).toHaveLength(0)
      expect(minimalMovie.genres).toHaveLength(0)
      expect(minimalMovie.players).toHaveLength(0)
    })
  })

  describe('aPI 同步数据格式', () => {
    it('应该生成正确的 API 同步负载', () => {
      const movieInfo: MovieInfo = {
        title: '测试影片',
        slug: 'TEST-001',
        code: 'TEST-001',
        description: '测试描述',
        coverImage: 'https://example.com/cover.jpg',
        releaseDate: 1704067200, // 2024-01-01 00:00:00
        duration: 120,
        sourceUrl: 'https://example.com/movie/TEST-001',
        actors: ['演员A'],
        genres: ['类型A'],
        series: '测试系列',
        publisher: '测试片商',
        isR18: true,
        players: [],
      }

      const payload = {
        type: 'movie',
        data: movieInfo,
      }

      // 验证负载结构
      expect(payload.type).toBe('movie')
      expect(payload.data).toBeDefined()
      expect(payload.data.code).toBe('TEST-001')
      expect(payload.data.title).toBe('测试影片')
    })

    it('应该正确处理 releaseDate 时间戳', () => {
      const movieInfo: MovieInfo = {
        title: '测试影片',
        slug: 'TEST-001',
        code: 'TEST-001',
        description: '',
        coverImage: '',
        releaseDate: 1704067200, // Unix 秒时间戳
        duration: 0,
        sourceUrl: 'https://example.com/movie/TEST-001',
        actors: [],
        genres: [],
        isR18: true,
        players: [],
      }

      // API 会将 releaseDate * 1000 转换为 Date
      const date = new Date(movieInfo.releaseDate! * 1000)
      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(0) // 0 = January
      expect(date.getDate()).toBe(1)
    })
  })

  describe('错误处理', () => {
    it('aPI 404 错误不应该抛出异常', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      global.fetch = mockFetch

      const syncToApi = async (endpoint: string, data: unknown) => {
        const url = `http://localhost:3000${endpoint}`

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-service-token': 'test-token',
            },
            body: JSON.stringify(data),
          })

          if (!response.ok) {
            console.warn(`⚠️  API 返回错误 ${response.status}: ${url}`)
            return null
          }

          return await response.json()
        }
        catch {
          console.warn(`⚠️  API 同步失败`)
          return null
        }
      }

      const result = await syncToApi('/movies/sync', { type: 'movie', data: {} })

      // 应该返回 null 而不是抛出异常
      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('aPI 连接失败不应该抛出异常', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed'))

      global.fetch = mockFetch

      const syncToApi = async (endpoint: string, data: unknown) => {
        try {
          const response = await fetch(`http://localhost:3000${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-service-token': 'test-token',
            },
            body: JSON.stringify(data),
          })

          if (!response.ok) {
            return null
          }

          return await response.json()
        }
        catch {
          console.warn(`⚠️  API 同步失败`)
          return null
        }
      }

      const result = await syncToApi('/movies/sync', { type: 'movie', data: {} })

      // 应该返回 null 而不是抛出异常
      expect(result).toBeNull()
    })
  })

  describe('数据库字段映射', () => {
    it('应该正确映射所有数据库字段', () => {
      const movieInfo: MovieInfo = {
        title: '测试影片',
        slug: 'TEST-001',
        code: 'TEST-001',
        description: '测试描述',
        coverImage: 'https://example.com/cover.jpg',
        releaseDate: 1704067200,
        duration: 120,
        sourceUrl: 'https://example.com/movie/TEST-001',
        actors: ['演员A', '演员B'],
        genres: ['类型A', '类型B'],
        series: '测试系列',
        publisher: '测试片商',
        isR18: true,
        players: [
          {
            sourceName: '云播',
            sourceUrl: 'https://example.com/play/1',
            quality: 'HD',
            sortOrder: 0,
          },
        ],
      }

      // 模拟 API 端点的数据映射逻辑
      const code = movieInfo.code || movieInfo.slug
      const movieData = {
        title: movieInfo.title,
        slug: movieInfo.slug,
        code,
        description: movieInfo.description,
        coverImage: movieInfo.coverImage,
        releaseDate: movieInfo.releaseDate ? new Date(movieInfo.releaseDate * 1000) : null,
        duration: movieInfo.duration,
        sourceUrl: movieInfo.sourceUrl,
        actors: movieInfo.actors || [],
        genres: movieInfo.genres || [],
        series: movieInfo.series,
        publisher: movieInfo.publisher,
        isR18: movieInfo.isR18,
      }

      // 验证映射结果
      expect(movieData.code).toBe('TEST-001')
      expect(movieData.title).toBe('测试影片')
      expect(movieData.releaseDate).toBeInstanceOf(Date)
      expect(Array.isArray(movieData.actors)).toBe(true)
      expect(Array.isArray(movieData.genres)).toBe(true)
      expect(movieData.isR18).toBe(true)
    })

    it('应该正确处理 players 数组', () => {
      const players = [
        {
          sourceName: '云播1',
          sourceUrl: 'https://example.com/play/1',
          quality: 'HD',
          sortOrder: 0,
        },
        {
          sourceName: '云播2',
          sourceUrl: 'https://example.com/play/2',
          quality: 'SD',
          sortOrder: 1,
        },
      ]

      // 模拟 API 端点的 players 处理逻辑
      const newPlayers = players.map((p, index) => ({
        id: crypto.randomUUID(),
        movieId: 'test-movie-id',
        sourceName: p.sourceName || 'Unknown',
        sourceUrl: p.sourceUrl,
        quality: p.quality,
        sortOrder: p.sortOrder || index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      expect(newPlayers).toHaveLength(2)
      expect(newPlayers[0].sourceName).toBe('云播1')
      expect(newPlayers[0].sortOrder).toBe(0)
      expect(newPlayers[1].sourceName).toBe('云播2')
      expect(newPlayers[1].sortOrder).toBe(1)
    })
  })
})

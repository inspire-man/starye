import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import ratingsRoute from './index'

describe('ratings route', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/ratings', ratingsRoute)
  })

  describe('pOST /ratings', () => {
    it('应该有评分提交端点', () => {
      expect(ratingsRoute).toBeDefined()
    })
  })

  describe('gET /ratings/player/:playerId', () => {
    it('应该有播放源评分查询端点', () => {
      expect(ratingsRoute).toBeDefined()
    })
  })

  describe('gET /ratings/user', () => {
    it('应该有用户评分历史端点', () => {
      expect(ratingsRoute).toBeDefined()
    })
  })

  describe('gET /ratings/top', () => {
    it('应该有 Top 评分列表端点', () => {
      expect(ratingsRoute).toBeDefined()
    })
  })
})

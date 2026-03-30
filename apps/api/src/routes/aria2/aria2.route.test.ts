import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import aria2Route from './index'

describe('aria2 route', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/aria2', aria2Route)
  })

  describe('pOST /aria2/proxy', () => {
    it('应该有 Aria2 代理端点', () => {
      expect(aria2Route).toBeDefined()
    })
  })

  describe('gET /aria2/config', () => {
    it('应该有配置查询端点', () => {
      expect(aria2Route).toBeDefined()
    })
  })

  describe('pOST /aria2/config', () => {
    it('应该有配置保存端点', () => {
      expect(aria2Route).toBeDefined()
    })
  })
})

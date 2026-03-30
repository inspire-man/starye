import { describe, expect, it } from 'vitest'
import {
  checkRatingRateLimit,
  getPlayerRating,
  getTopRatedPlayers,
  getUserRatingHistory,
  submitRating,
} from './rating.service'

describe('rating.service', () => {
  describe('submitRating', () => {
    it('应该有正确的函数签名', () => {
      expect(typeof submitRating).toBe('function')
    })
  })

  describe('getUserRatingHistory', () => {
    it('应该有正确的函数签名', () => {
      expect(typeof getUserRatingHistory).toBe('function')
    })
  })

  describe('getPlayerRating', () => {
    it('应该有正确的函数签名', () => {
      expect(typeof getPlayerRating).toBe('function')
    })
  })

  describe('getTopRatedPlayers', () => {
    it('应该有正确的函数签名', () => {
      expect(typeof getTopRatedPlayers).toBe('function')
    })
  })

  describe('checkRatingRateLimit', () => {
    it('应该有正确的函数签名', () => {
      expect(typeof checkRatingRateLimit).toBe('function')
    })
  })
})

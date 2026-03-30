import { describe, expect, it } from 'vitest'
import {
  scoreByQuality,
  scoreByFileSize,
  scoreBySource,
  calculateAutoScore,
  calculateCompositeScore,
  generateRecommendationTag,
  generateWarningTag,
} from './ratingAlgorithm'

describe('ratingAlgorithm', () => {
  describe('scoreByQuality', () => {
    it('应该为 4K 返回 100 分', () => {
      expect(scoreByQuality('4K')).toBe(100)
    })

    it('应该为 1080P 返回 85 分', () => {
      expect(scoreByQuality('1080P')).toBe(85)
      expect(scoreByQuality('1080')).toBe(85)
    })

    it('应该为 720P 返回 60 分', () => {
      expect(scoreByQuality('720P')).toBe(60)
      expect(scoreByQuality('720')).toBe(60)
    })

    it('应该为 SD 返回 40 分', () => {
      expect(scoreByQuality('SD')).toBe(40)
      expect(scoreByQuality('480P')).toBe(40)
    })

    it('应该为 HD 返回 75 分', () => {
      expect(scoreByQuality('HD')).toBe(75)
    })

    it('应该不区分大小写', () => {
      expect(scoreByQuality('4k')).toBe(100)
      expect(scoreByQuality('1080p')).toBe(85)
      expect(scoreByQuality('hd')).toBe(75)
    })

    it('应该为未知画质返回默认值 50', () => {
      expect(scoreByQuality('未知')).toBe(50)
      expect(scoreByQuality('')).toBe(50)
      expect(scoreByQuality(null)).toBe(50)
    })
  })

  describe('scoreByFileSize', () => {
    it('应该为 4K 视频的理想大小返回 +10', () => {
      expect(scoreByFileSize('4K', 15)).toBe(10) // 理想值
      expect(scoreByFileSize('4K', 13)).toBe(10) // 理想范围内（15 * 0.8 = 12）
      expect(scoreByFileSize('4K', 17)).toBe(10) // 理想范围内（15 * 1.2 = 18）
    })

    it('应该为 1080P 视频的理想大小返回 +10', () => {
      expect(scoreByFileSize('1080P', 8)).toBe(10) // 理想值
      expect(scoreByFileSize('1080P', 7)).toBe(10) // 理想范围内
      expect(scoreByFileSize('1080P', 9)).toBe(10) // 理想范围内
    })

    it('应该为过小的文件返回 -20', () => {
      expect(scoreByFileSize('4K', 5)).toBe(-20) // < 8GB
      expect(scoreByFileSize('1080P', 2)).toBe(-20) // < 4GB
    })

    it('应该为过大的文件返回 -10', () => {
      expect(scoreByFileSize('4K', 35)).toBe(-10) // > 30GB
      expect(scoreByFileSize('1080P', 20)).toBe(-10) // > 15GB
    })

    it('应该为合理但非理想的文件返回 0', () => {
      expect(scoreByFileSize('4K', 10)).toBe(0) // 在范围内但不在理想范围
      expect(scoreByFileSize('1080P', 5)).toBe(0)
    })

    it('应该处理 0 大小', () => {
      expect(scoreByFileSize('1080P', 0)).toBe(0)
    })

    it('应该处理 null 大小', () => {
      expect(scoreByFileSize('1080P', null)).toBe(0)
    })

    it('应该处理负数大小', () => {
      expect(scoreByFileSize('1080P', -1)).toBe(0)
    })

    it('应该处理未知画质', () => {
      expect(scoreByFileSize('未知', 10)).toBe(0)
    })
  })

  describe('scoreBySource', () => {
    it('应该为可信来源返回 +15', () => {
      expect(scoreBySource('https://javbus.com/ABC-123')).toBe(15)
      expect(scoreBySource('https://javdb.com/v/XYZ')).toBe(15)
      expect(scoreBySource('https://dmm.co.jp/item')).toBe(15)
    })

    it('应该为未知来源返回 0', () => {
      expect(scoreBySource('https://unknown-site.com/file')).toBe(0)
    })

    it('应该不区分 http 和 https', () => {
      expect(scoreBySource('http://javbus.com/ABC-123')).toBe(15)
      expect(scoreBySource('https://javbus.com/ABC-123')).toBe(15)
    })

    it('应该识别域名（忽略子域名）', () => {
      expect(scoreBySource('https://www.javbus.com/ABC-123')).toBe(15)
      expect(scoreBySource('https://cdn.javdb.com/image.jpg')).toBe(15)
    })

    it('应该处理磁力链接', () => {
      expect(scoreBySource('magnet:?xt=urn:btih:ABC123')).toBe(0)
    })

    it('应该处理空字符串', () => {
      expect(scoreBySource('')).toBe(0)
    })

    it('应该处理 null', () => {
      expect(scoreBySource(null)).toBe(0)
    })
  })

  describe('calculateAutoScore', () => {
    it('应该计算综合自动评分', () => {
      const score = calculateAutoScore('1080P', 8, 'https://javbus.com')

      // 画质分: 85 * 0.6 = 51
      // 大小分: +10 * 0.2 = +2
      // 来源分: +15 * 0.2 = +3
      // 总分: 56
      expect(score).toBe(56)
    })

    it('应该仅使用画质分（无文件大小和来源）', () => {
      const score = calculateAutoScore('1080P')

      // 画质分: 85 * 0.6 = 51
      expect(score).toBe(51)
    })

    it('应该为高质量内容返回高分', () => {
      const score = calculateAutoScore('4K', 15, 'https://javbus.com')

      // 画质: 100 * 0.6 = 60
      // 大小: +10 * 0.2 = +2
      // 来源: +15 * 0.2 = +3
      // 总分: 65
      expect(score).toBe(65)
    })

    it('应该为低质量内容返回低分', () => {
      const score = calculateAutoScore('SD', 0.3, 'https://unknown.com')

      // 画质: 40 * 0.6 = 24
      // 大小: -20 * 0.2 = -4
      // 来源: 0
      // 总分: 20
      expect(score).toBe(20)
    })

    it('应该限制最小值为 0', () => {
      const score = calculateAutoScore('360P', 0.1, null)

      expect(score).toBeGreaterThanOrEqual(0)
    })

    it('应该限制最大值为 100', () => {
      const score = calculateAutoScore('4K', 15, 'https://javbus.com')

      expect(score).toBeLessThanOrEqual(100)
    })

    it('应该处理缺失的可选字段', () => {
      expect(() => calculateAutoScore('1080P', null, null)).not.toThrow()
      expect(() => calculateAutoScore('1080P', undefined, undefined)).not.toThrow()
    })
  })

  describe('calculateCompositeScore', () => {
    it('应该在无用户评分时返回自动评分', () => {
      expect(calculateCompositeScore(70)).toBe(70)
      expect(calculateCompositeScore(70, undefined, 0)).toBe(70)
    })

    it('应该计算综合评分（自动 + 用户）', () => {
      // 评分人数 < 10，权重 40:60
      const score = calculateCompositeScore(60, 80, 5)

      // 60 * 0.4 + 80 * 0.6 = 24 + 48 = 72
      expect(score).toBe(72)
    })

    it('应该随评分人数增加用户评分权重', () => {
      const autoScore = 60
      const userScore = 80

      // 少于 10 人: 40:60
      const score1 = calculateCompositeScore(autoScore, userScore, 5)
      expect(score1).toBe(72)

      // 10-19 人: 30:70
      const score2 = calculateCompositeScore(autoScore, userScore, 10)
      expect(score2).toBe(74)

      // 20+ 人: 20:80
      const score3 = calculateCompositeScore(autoScore, userScore, 20)
      expect(score3).toBe(76)
    })

    it('应该限制评分范围在 0-100', () => {
      const score = calculateCompositeScore(100, 100, 20)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('generateRecommendationTag', () => {
    it('应该为高分且足够人数生成"强烈推荐"', () => {
      expect(generateRecommendationTag(95, 15)).toBe('highly-recommended')
    })

    it('应该为高分但人数不足生成"推荐"', () => {
      expect(generateRecommendationTag(95, 5)).toBe('recommended')
    })

    it('应该为良好分数生成"推荐"', () => {
      expect(generateRecommendationTag(85, 5)).toBe('recommended')
      expect(generateRecommendationTag(80, 0)).toBe('recommended')
    })

    it('应该为较低分数不返回标签', () => {
      expect(generateRecommendationTag(75)).toBe('none')
      expect(generateRecommendationTag(60)).toBe('none')
    })

    it('应该处理边界值 90', () => {
      expect(generateRecommendationTag(90, 10)).toBe('highly-recommended')
      expect(generateRecommendationTag(89, 10)).toBe('recommended')
    })

    it('应该处理边界值 80', () => {
      expect(generateRecommendationTag(80, 5)).toBe('recommended')
      expect(generateRecommendationTag(79, 5)).toBe('none')
    })
  })

  describe('generateWarningTag', () => {
    it('应该为极低分且足够人数生成"低质量"警告', () => {
      expect(generateWarningTag(30, 10)).toBe('low-quality')
      expect(generateWarningTag(39, 5)).toBe('low-quality')
    })

    it('应该为无评分生成"新资源"标签', () => {
      expect(generateWarningTag(50, 0)).toBe('new')
      expect(generateWarningTag(50)).toBe('new')
    })

    it('应该为正常分数不返回警告', () => {
      expect(generateWarningTag(50, 10)).toBe('none')
      expect(generateWarningTag(70, 5)).toBe('none')
    })

    it('应该处理边界值 40', () => {
      expect(generateWarningTag(39, 5)).toBe('low-quality')
      expect(generateWarningTag(40, 5)).toBe('none')
    })

    it('应该在人数不足时不生成低质量警告', () => {
      expect(generateWarningTag(30, 3)).toBe('none') // 人数 < 5
    })
  })

  describe('完整评分场景', () => {
    it('应该为优质 4K 源生成高分', () => {
      const autoScore = calculateAutoScore('4K', 15, 'https://javbus.com')
      const compositeScore = calculateCompositeScore(autoScore, 90, 20)
      const tag = generateRecommendationTag(compositeScore, 20)

      expect(autoScore).toBeGreaterThan(60)
      expect(compositeScore).toBeGreaterThan(70)
      expect(tag).not.toBe('none')
    })

    it('应该为低质量源生成警告', () => {
      const autoScore = calculateAutoScore('SD', 0.3, null)
      const compositeScore = calculateCompositeScore(autoScore, 30, 10)
      const warningTag = generateWarningTag(compositeScore, 10)

      expect(autoScore).toBeLessThan(40)
      expect(compositeScore).toBeLessThan(50)
      expect(warningTag).toBe('low-quality')
    })

    it('应该为新源（无用户评分）生成标签', () => {
      const autoScore = calculateAutoScore('1080P', 8, 'https://javdb.com')
      const compositeScore = calculateCompositeScore(autoScore)
      const warningTag = generateWarningTag(compositeScore, 0)

      expect(warningTag).toBe('new')
    })

    it('应该正确处理用户评分修正', () => {
      // 自动评分低，但用户评分高
      const autoScore = calculateAutoScore('720P', null, null)
      const compositeScore = calculateCompositeScore(autoScore, 90, 15)

      // 用户评分应该提升综合分
      expect(compositeScore).toBeGreaterThan(autoScore)
    })
  })
})

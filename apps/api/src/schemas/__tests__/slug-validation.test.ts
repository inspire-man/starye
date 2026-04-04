import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { GetActorParamSchema } from '../actor'
import { EntitySlugSchema, SlugSchema } from '../common'
import { GetPublisherParamSchema } from '../publisher'

describe('slugSchema — 严格 ASCII slug 验证', () => {
  it('通过：标准 slug', () => {
    expect(v.safeParse(SlugSchema, 'normal-actor').success).toBe(true)
    expect(v.safeParse(SlugSchema, 'abc123').success).toBe(true)
  })

  it('拒绝：中文字符', () => {
    expect(v.safeParse(SlugSchema, '波多野结衣').success).toBe(false)
  })

  it('拒绝：含点号', () => {
    expect(v.safeParse(SlugSchema, 's1-no.1-style').success).toBe(false)
  })
})

describe('entitySlugSchema — 宽松实体标识符验证', () => {
  it('通过：中文演员名（实际 DB 存储格式）', () => {
    expect(v.safeParse(EntitySlugSchema, '波多野结衣').success).toBe(true)
    expect(v.safeParse(EntitySlugSchema, '蒼井そら').success).toBe(true)
  })

  it('通过：含点号的厂商名（实际 DB 存储格式）', () => {
    expect(v.safeParse(EntitySlugSchema, 's1-no.1-style').success).toBe(true)
    expect(v.safeParse(EntitySlugSchema, 'fitch.inc').success).toBe(true)
  })

  it('通过：普通 ASCII slug', () => {
    expect(v.safeParse(EntitySlugSchema, 'normal-actor').success).toBe(true)
  })

  it('拒绝：空字符串', () => {
    expect(v.safeParse(EntitySlugSchema, '').success).toBe(false)
  })

  it('拒绝：超过 200 字符', () => {
    expect(v.safeParse(EntitySlugSchema, 'a'.repeat(201)).success).toBe(false)
  })
})

describe('getActorParamSchema — 演员路由参数', () => {
  it('通过：中文名 slug（修复前会返回 400）', () => {
    expect(v.safeParse(GetActorParamSchema, { slug: '波多野结衣' }).success).toBe(true)
  })

  it('通过：日文名 slug', () => {
    expect(v.safeParse(GetActorParamSchema, { slug: '波多野結衣' }).success).toBe(true)
  })

  it('通过：普通 slug', () => {
    expect(v.safeParse(GetActorParamSchema, { slug: 'miku-abeno' }).success).toBe(true)
  })

  it('拒绝：空 slug', () => {
    expect(v.safeParse(GetActorParamSchema, { slug: '' }).success).toBe(false)
  })
})

describe('getPublisherParamSchema — 厂商路由参数', () => {
  it('通过：含点号的 slug（修复前会返回 400）', () => {
    expect(v.safeParse(GetPublisherParamSchema, { slug: 's1-no.1-style' }).success).toBe(true)
  })

  it('通过：普通 slug', () => {
    expect(v.safeParse(GetPublisherParamSchema, { slug: 'moodyz' }).success).toBe(true)
  })

  it('拒绝：空 slug', () => {
    expect(v.safeParse(GetPublisherParamSchema, { slug: '' }).success).toBe(false)
  })
})

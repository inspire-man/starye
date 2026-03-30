/**
 * SeesaaWiki 数据结构类型定义
 */

// 女优详细信息
export interface ActorDetails {
  name: string // 主名
  reading?: string // 读音（如 "もりさわかな"）
  aliases: string[] // 别名列表
  bio?: string // 简介
  birthDate?: number // 生日（Unix 时间戳）
  height?: number // 身高 (cm)
  measurements?: string // 三围
  cupSize?: string // 罩杯
  bloodType?: string // 血型
  nationality?: string // 国籍
  debutDate?: number // 出道日期（Unix 时间戳）
  retireDate?: number // 引退日期（Unix 时间戳）
  isActive: boolean // 是否活跃
  blog?: string // 博客链接
  twitter?: string // Twitter handle
  instagram?: string // Instagram handle
  socialLinks?: Record<string, string> // 其他社交媒体链接
  works?: Work[] // 作品列表
  wikiUrl: string // Wiki 页面 URL
}

// 作品信息
export interface Work {
  releaseDate?: string // 发售日期 (YYYY/MM/DD)
  productCode?: string // 品番
  title?: string // 作品名
  publisher?: string // 厂商名
  fanzaUrl?: string // FANZA 链接
}

// 厂商详细信息
export interface PublisherDetails {
  name: string // 厂商名
  logo?: string // Logo URL
  website?: string // 官网
  description?: string // 简介
  foundedYear?: number // 成立年份
  country?: string // 国家
  twitter?: string // Twitter handle
  instagram?: string // Instagram handle
  parentPublisher?: string // 母公司/品牌
  brandSeries?: string // 品牌系列标识
  wikiUrl: string // Wiki 页面 URL
}

// 索引页女优条目
export interface ActorIndexEntry {
  name: string // 主名
  aliases: string[] // 别名列表
  wikiUrl: string // 详情页 URL
  isRenamed: boolean // 是否改名（用 ⇒ 标记）
}

// 索引页厂商条目
export interface PublisherIndexEntry {
  name: string // 厂商名
  wikiUrl: string // 详情页 URL
}

// 五十音行
export type GojuonLine
  = | 'あ'
    | 'か'
    | 'さ'
    | 'た'
    | 'な'
    | 'は'
    | 'ま'
    | 'や'
    | 'ら'
    | 'わ'
    | '英数'

// 索引页解析结果
export interface IndexPageResult {
  actors: ActorIndexEntry[]
  hasNextPage: boolean
  nextPageNumber?: number
}

// 解析错误
export interface ParseError {
  field: string // 字段名
  reason: string // 失败原因
  rawValue?: string // 原始值
}

// 解析结果（包含成功和失败信息）
export interface ParseResult<T> {
  data: T
  errors: ParseError[] // 解析过程中遇到的非致命错误
  warnings: string[] // 警告信息
}

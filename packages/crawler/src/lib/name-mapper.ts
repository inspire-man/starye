/* eslint-disable node/prefer-global/process */
/**
 * 名字映射系统
 * 实现 JavBus 名到 SeesaaWiki 名的三阶段匹配算法
 */

import type { Page } from 'puppeteer-core'
import type { SeesaaWikiStrategy } from '../strategies/seesaawiki/seesaawiki-strategy'
import type { GojuonLine } from '../strategies/seesaawiki/types'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 名字映射表结构
export interface NameMapping {
  javbusName: string
  wikiName: string
  wikiUrl: string
  lastUpdated: number // Unix 时间戳
}

// 未匹配记录
export interface UnmappedRecord {
  javbusName: string
  attempts: string[] // 尝试过的匹配策略
  lastAttempt: number // Unix 时间戳
  priority?: number // 优先级（基于作品数）
}

// 映射质量报告
export interface MappingQualityReport {
  totalMappings: number
  conflicts: Array<{ javbusName: string, wikiNames: string[] }>
  coverage: number // 映射覆盖率 0-1
  unmappedCount: number
  highPriorityUnmapped: UnmappedRecord[] // 高优先级未匹配（作品数 > 50）
}

export interface NameMapperConfig {
  actorMapFile?: string
  publisherMapFile?: string
  unmappedActorsFile?: string
  unmappedPublishersFile?: string
  uploadToR2?: boolean // 是否上传到 R2
  r2Config?: import('./image-processor').R2Config // R2 配置
}

export class NameMapper {
  // 名字映射表（JavBus 名 -> Wiki 名和 URL）
  private actorMap = new Map<string, NameMapping>()
  private publisherMap = new Map<string, NameMapping>()

  // 别名反向索引（别名 -> 主名）
  private actorAliasToMain = new Map<string, string>()

  // 未匹配名单
  private unmappedActors = new Map<string, UnmappedRecord>()
  private unmappedPublishers = new Map<string, UnmappedRecord>()

  private config: {
    actorMapFile: string
    publisherMapFile: string
    unmappedActorsFile: string
    unmappedPublishersFile: string
    uploadToR2: boolean
    r2Config?: import('./image-processor').R2Config
  }

  private seesaaWikiStrategy: SeesaaWikiStrategy
  private isDirty = false // 映射表是否需要保存
  private mappingFileManager?: import('./mapping-file-manager').MappingFileManager

  constructor(
    seesaaWikiStrategy: SeesaaWikiStrategy,
    config: NameMapperConfig = {},
  ) {
    this.seesaaWikiStrategy = seesaaWikiStrategy

    this.config = {
      actorMapFile: config.actorMapFile ?? resolve(process.cwd(), '.seesaawiki-actor-map.json'),
      publisherMapFile: config.publisherMapFile ?? resolve(process.cwd(), '.seesaawiki-publisher-map.json'),
      unmappedActorsFile: config.unmappedActorsFile ?? resolve(process.cwd(), '.seesaawiki-unmapped-actors.json'),
      unmappedPublishersFile: config.unmappedPublishersFile ?? resolve(process.cwd(), '.seesaawiki-unmapped-publishers.json'),
      uploadToR2: config.uploadToR2 ?? false,
      r2Config: config.r2Config,
    }

    // 加载映射表
    this.loadMappings()
  }

  /**
   * 加载映射表文件
   */
  private loadMappings() {
    // 加载女优映射表
    try {
      const actorData = readFileSync(this.config.actorMapFile, 'utf-8')
      const actorMappings: NameMapping[] = JSON.parse(actorData)
      for (const mapping of actorMappings) {
        this.actorMap.set(mapping.javbusName, mapping)
      }
      console.warn(`[NameMapper] 加载女优映射表: ${this.actorMap.size} 条`)
    }
    catch {
      console.warn('[NameMapper] 女优映射表文件不存在或为空，将创建新映射表')
    }

    // 加载厂商映射表
    try {
      const publisherData = readFileSync(this.config.publisherMapFile, 'utf-8')
      const publisherMappings: NameMapping[] = JSON.parse(publisherData)
      for (const mapping of publisherMappings) {
        this.publisherMap.set(mapping.javbusName, mapping)
      }
      console.warn(`[NameMapper] 加载厂商映射表: ${this.publisherMap.size} 条`)
    }
    catch {
      console.warn('[NameMapper] 厂商映射表文件不存在或为空，将创建新映射表')
    }

    // 加载未匹配女优清单
    try {
      const unmappedActorsData = readFileSync(this.config.unmappedActorsFile, 'utf-8')
      const unmappedActors: UnmappedRecord[] = JSON.parse(unmappedActorsData)
      for (const record of unmappedActors) {
        this.unmappedActors.set(record.javbusName, record)
      }
      console.warn(`[NameMapper] 加载未匹配女优清单: ${this.unmappedActors.size} 条`)
    }
    catch {
      // 忽略，文件不存在时会自动创建
    }

    // 加载未匹配厂商清单
    try {
      const unmappedPublishersData = readFileSync(this.config.unmappedPublishersFile, 'utf-8')
      const unmappedPublishers: UnmappedRecord[] = JSON.parse(unmappedPublishersData)
      for (const record of unmappedPublishers) {
        this.unmappedPublishers.set(record.javbusName, record)
      }
      console.warn(`[NameMapper] 加载未匹配厂商清单: ${this.unmappedPublishers.size} 条`)
    }
    catch {
      // 忽略
    }

    // 建立别名反向索引
    this.buildAliasIndex()
  }

  /**
   * 建立别名反向索引
   */
  private buildAliasIndex() {
    for (const mapping of this.actorMap.values()) {
      // 主名也加入索引
      this.actorAliasToMain.set(mapping.wikiName, mapping.wikiName)
    }
    console.warn(`[NameMapper] 建立别名反向索引: ${this.actorAliasToMain.size} 条`)
  }

  /**
   * 持久化映射表
   */
  async saveMappings() {
    if (!this.isDirty)
      return

    try {
      // 保存女优映射表
      const actorMappings = Array.from(this.actorMap.values())
      writeFileSync(this.config.actorMapFile, JSON.stringify(actorMappings, null, 2), 'utf-8')

      // 保存厂商映射表
      const publisherMappings = Array.from(this.publisherMap.values())
      writeFileSync(this.config.publisherMapFile, JSON.stringify(publisherMappings, null, 2), 'utf-8')

      // 保存未匹配清单
      const unmappedActors = Array.from(this.unmappedActors.values())
      if (unmappedActors.length > 0) {
        writeFileSync(this.config.unmappedActorsFile, JSON.stringify(unmappedActors, null, 2), 'utf-8')
      }

      const unmappedPublishers = Array.from(this.unmappedPublishers.values())
      if (unmappedPublishers.length > 0) {
        writeFileSync(this.config.unmappedPublishersFile, JSON.stringify(unmappedPublishers, null, 2), 'utf-8')
      }

      this.isDirty = false
      console.warn('[NameMapper] ✅ 映射表已保存到本地文件')

      // 上传到 R2（如果配置）
      if (this.config.uploadToR2 && this.config.r2Config) {
        // 延迟初始化 MappingFileManager
        if (!this.mappingFileManager) {
          const { MappingFileManager } = await import('./mapping-file-manager.js')
          this.mappingFileManager = new MappingFileManager(this.config.r2Config)
        }

        console.warn('[NameMapper] 📤 上传映射文件到 R2...')

        // 将映射表转换为对象格式（兼容旧格式）
        const actorMapObj: Record<string, any> = {}
        for (const [key, value] of this.actorMap) {
          actorMapObj[key] = value
        }

        const publisherMapObj: Record<string, any> = {}
        for (const [key, value] of this.publisherMap) {
          publisherMapObj[key] = value
        }

        await this.mappingFileManager.uploadAllMappings({
          actorNameMap: actorMapObj,
          publisherNameMap: publisherMapObj,
          unmappedActors,
          unmappedPublishers,
        })

        console.warn('[NameMapper] ✅ 映射文件已上传到 R2')
      }
    }
    catch (error) {
      console.error('[NameMapper] ❌ 保存映射表失败', error)
    }
  }

  /**
   * 添加映射
   */
  private addActorMapping(javbusName: string, wikiName: string, wikiUrl: string) {
    this.actorMap.set(javbusName, {
      javbusName,
      wikiName,
      wikiUrl,
      lastUpdated: Math.floor(Date.now() / 1000),
    })
    this.isDirty = true

    // 从未匹配清单中移除
    if (this.unmappedActors.has(javbusName)) {
      this.unmappedActors.delete(javbusName)
      this.isDirty = true
    }
  }

  /**
   * 添加未匹配记录
   */
  private addUnmappedActor(javbusName: string, attempts: string[], priority?: number) {
    this.unmappedActors.set(javbusName, {
      javbusName,
      attempts,
      lastAttempt: Math.floor(Date.now() / 1000),
      priority,
    })
    this.isDirty = true
  }

  /**
   * 获取五十音行
   * 根据名字首字符定位五十音行
   */
  private getGojuonLine(name: string): GojuonLine | null {
    if (!name || name.length === 0)
      return null

    const firstChar = name[0]

    // 平假名映射
    const hiraganaMap: Record<string, GojuonLine> = {
      あいうえお: 'あ',
      かきくけこがぎぐげご: 'か',
      さしすせそざじずぜぞ: 'さ',
      たちつてとだぢづでど: 'た',
      なにぬねの: 'な',
      はひふへほばびぶべぼぱぴぷぺぽ: 'は',
      まみむめも: 'ま',
      やゆよ: 'や',
      らりるれろ: 'ら',
      わをん: 'わ',
    }

    // 片假名映射（转换为平假名）
    const katakanaToHiragana: Record<string, string> = {
      ア: 'あ',
      イ: 'い',
      ウ: 'う',
      エ: 'え',
      オ: 'お',
      カ: 'か',
      キ: 'き',
      ク: 'く',
      ケ: 'け',
      コ: 'こ',
      ガ: 'が',
      ギ: 'ぎ',
      グ: 'ぐ',
      ゲ: 'げ',
      ゴ: 'ご',
      サ: 'さ',
      シ: 'し',
      ス: 'す',
      セ: 'せ',
      ソ: 'そ',
      ザ: 'ざ',
      ジ: 'じ',
      ズ: 'ず',
      ゼ: 'ぜ',
      ゾ: 'ぞ',
      タ: 'た',
      チ: 'ち',
      ツ: 'つ',
      テ: 'て',
      ト: 'と',
      ダ: 'だ',
      ヂ: 'ぢ',
      ヅ: 'づ',
      デ: 'で',
      ド: 'ど',
      ナ: 'な',
      ニ: 'に',
      ヌ: 'ぬ',
      ネ: 'ね',
      ノ: 'の',
      ハ: 'は',
      ヒ: 'ひ',
      フ: 'ふ',
      ヘ: 'へ',
      ホ: 'ほ',
      バ: 'ば',
      ビ: 'び',
      ブ: 'ぶ',
      ベ: 'べ',
      ボ: 'ぼ',
      パ: 'ぱ',
      ピ: 'ぴ',
      プ: 'ぷ',
      ペ: 'ぺ',
      ポ: 'ぽ',
      マ: 'ま',
      ミ: 'み',
      ム: 'む',
      メ: 'め',
      モ: 'も',
      ヤ: 'や',
      ユ: 'ゆ',
      ヨ: 'よ',
      ラ: 'ら',
      リ: 'り',
      ル: 'る',
      レ: 'れ',
      ロ: 'ろ',
      ワ: 'わ',
      ヲ: 'を',
      ン: 'ん',
    }

    // 转换片假名为平假名
    let char = firstChar
    if (katakanaToHiragana[firstChar]) {
      char = katakanaToHiragana[firstChar]
    }

    // 查找五十音行
    for (const [chars, line] of Object.entries(hiraganaMap)) {
      if (chars.includes(char)) {
        return line
      }
    }

    // 英文或数字
    if (/[A-Z0-9]/i.test(firstChar)) {
      return '英数'
    }

    return null
  }

  /**
   * 三阶段匹配：女优名
   */
  async matchActorName(javbusName: string, page: Page): Promise<NameMapping | null> {
    // 检查是否在未匹配清单中（避免重复尝试）
    if (this.unmappedActors.has(javbusName)) {
      console.warn(`[NameMapper] 跳过已知未匹配女优: ${javbusName}`)
      return null
    }

    const attempts: string[] = []

    // 阶段 1: 查询本地缓存
    if (this.actorMap.has(javbusName)) {
      console.warn(`[NameMapper] ✅ 缓存命中: ${javbusName}`)
      const cached = this.actorMap.get(javbusName)!
      // 重新构建URL（确保使用正确的EUC-JP编码）
      const correctedUrl = this.seesaaWikiStrategy.buildActorUrl(cached.wikiName)
      return {
        ...cached,
        wikiUrl: correctedUrl,
      }
    }
    attempts.push('cache')

    // 阶段 2: 精确匹配
    try {
      const wikiUrl = this.seesaaWikiStrategy.buildActorUrl(javbusName)
      console.warn(`[NameMapper] 尝试精确匹配: ${wikiUrl}`)

      await page.goto(wikiUrl, { waitUntil: 'networkidle2', timeout: 15000 })

      const title = await page.title()
      const bodyText = await page.evaluate(() => document.body?.textContent || '')

      if (!title.includes('404')
        && !title.includes('Not Found')
        && !bodyText.includes('ページが見つかりませんでした')
        && !bodyText.includes('お探しのページは見つかりませんでした')) {
        // 精确匹配成功
        console.warn(`[NameMapper] ✅ 精确匹配成功: ${javbusName}`)
        this.addActorMapping(javbusName, javbusName, wikiUrl)
        return this.actorMap.get(javbusName)!
      }
    }
    catch (error) {
      console.warn(`[NameMapper] 精确匹配失败: ${javbusName}`, error)
    }
    attempts.push('exact')

    // 阶段 3: 索引页搜索
    const gojuonLine = this.getGojuonLine(javbusName)
    if (gojuonLine) {
      try {
        console.warn(`[NameMapper] 在索引页搜索: ${javbusName} (${gojuonLine}行)`)

        // 爬取索引页（可能有多页）
        let pageNumber = 1
        let hasNextPage = true

        while (hasNextPage && pageNumber <= 5) { // 最多爬取 5 页
          const indexResult = await this.seesaaWikiStrategy.fetchActorIndexPage(gojuonLine, page, pageNumber)

          // 在索引页中搜索匹配
          for (const entry of indexResult.actors) {
            // 检查主名或别名是否匹配
            if (entry.name === javbusName || entry.aliases.includes(javbusName)) {
              console.warn(`[NameMapper] ✅ 索引搜索成功: ${javbusName} -> ${entry.name}`)
              this.addActorMapping(javbusName, entry.name, entry.wikiUrl)
              return this.actorMap.get(javbusName)!
            }
          }

          hasNextPage = indexResult.hasNextPage
          pageNumber = indexResult.nextPageNumber ?? pageNumber + 1
        }
      }
      catch (error) {
        console.warn(`[NameMapper] 索引搜索失败: ${javbusName}`, error)
      }
      attempts.push('index')
    }

    // 阶段 4: 全部失败
    console.warn(`[NameMapper] ❌ 未能匹配女优: ${javbusName}`)
    this.addUnmappedActor(javbusName, attempts)
    return null
  }

  /**
   * 三阶段匹配：厂商名
   */
  async matchPublisherName(javbusName: string, page: Page): Promise<NameMapping | null> {
    // 检查是否在未匹配清单中
    if (this.unmappedPublishers.has(javbusName)) {
      console.warn(`[NameMapper] 跳过已知未匹配厂商: ${javbusName}`)
      return null
    }

    const attempts: string[] = []

    // 阶段 1: 查询本地缓存
    if (this.publisherMap.has(javbusName)) {
      console.warn(`[NameMapper] ✅ 缓存命中: ${javbusName}`)
      const cached = this.publisherMap.get(javbusName)!
      // 重新构建URL（确保使用正确的EUC-JP编码）
      const correctedUrl = this.seesaaWikiStrategy.buildPublisherUrl(cached.wikiName)
      return {
        ...cached,
        wikiUrl: correctedUrl,
      }
    }
    attempts.push('cache')

    // 阶段 2: 精确匹配
    try {
      const wikiUrl = this.seesaaWikiStrategy.buildPublisherUrl(javbusName)
      console.warn(`[NameMapper] 尝试精确匹配: ${wikiUrl}`)

      await page.goto(wikiUrl, { waitUntil: 'networkidle2', timeout: 15000 })

      const title = await page.title()
      const bodyText = await page.evaluate(() => document.body?.textContent || '')

      if (!title.includes('404')
        && !title.includes('Not Found')
        && !bodyText.includes('ページが見つかりませんでした')
        && !bodyText.includes('お探しのページは見つかりませんでした')) {
        // 精确匹配成功
        console.warn(`[NameMapper] ✅ 精确匹配成功: ${javbusName}`)
        const mapping: NameMapping = {
          javbusName,
          wikiName: javbusName,
          wikiUrl,
          lastUpdated: Math.floor(Date.now() / 1000),
        }
        this.publisherMap.set(javbusName, mapping)
        this.isDirty = true
        return mapping
      }
    }
    catch (error) {
      console.warn(`[NameMapper] 精确匹配失败: ${javbusName}`, error)
    }
    attempts.push('exact')

    // 阶段 3: 索引页搜索（厂商）
    const gojuonLine = this.getGojuonLine(javbusName)
    if (gojuonLine) {
      try {
        console.warn(`[NameMapper] 在索引页搜索: ${javbusName} (${gojuonLine}行)`)

        let pageNumber = 1
        let hasNextPage = true

        while (hasNextPage && pageNumber <= 3) {
          const indexResult = await this.seesaaWikiStrategy.fetchPublisherIndexPage(gojuonLine, page, pageNumber)

          for (const entry of indexResult.publishers) {
            if (entry.name === javbusName || entry.name.includes(javbusName)) {
              console.warn(`[NameMapper] ✅ 索引搜索成功: ${javbusName} -> ${entry.name}`)
              const mapping: NameMapping = {
                javbusName,
                wikiName: entry.name,
                wikiUrl: entry.wikiUrl,
                lastUpdated: Math.floor(Date.now() / 1000),
              }
              this.publisherMap.set(javbusName, mapping)
              this.isDirty = true
              return mapping
            }
          }

          hasNextPage = indexResult.hasNextPage
          pageNumber = indexResult.nextPageNumber ?? pageNumber + 1
        }
      }
      catch (error) {
        console.warn(`[NameMapper] 索引搜索失败: ${javbusName}`, error)
      }
      attempts.push('index')
    }

    // 全部失败
    console.warn(`[NameMapper] ❌ 未能匹配厂商: ${javbusName}`)
    this.unmappedPublishers.set(javbusName, {
      javbusName,
      attempts,
      lastAttempt: Math.floor(Date.now() / 1000),
    })
    this.isDirty = true
    return null
  }

  /**
   * 通过别名查询主名
   */
  findMainNameByAlias(alias: string): string | null {
    return this.actorAliasToMain.get(alias) ?? null
  }

  /**
   * 生成映射质量报告
   */
  generateQualityReport(): MappingQualityReport {
    // 检测冲突（多个 JavBus 名映射到同一个 Wiki 名）
    const wikiNameCount = new Map<string, string[]>()
    for (const [javbusName, mapping] of this.actorMap.entries()) {
      const existing = wikiNameCount.get(mapping.wikiName) ?? []
      existing.push(javbusName)
      wikiNameCount.set(mapping.wikiName, existing)
    }

    const conflicts = Array.from(wikiNameCount.entries())
      .filter(([_, javbusNames]) => javbusNames.length > 1)
      .map(([wikiName, javbusNames]) => ({ javbusName: javbusNames.join(', '), wikiNames: [wikiName] }))

    // 高优先级未匹配（作品数 > 50）
    const highPriorityUnmapped = Array.from(this.unmappedActors.values())
      .filter(record => (record.priority ?? 0) > 50)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

    return {
      totalMappings: this.actorMap.size,
      conflicts,
      coverage: 0, // 需要外部提供总女优数
      unmappedCount: this.unmappedActors.size,
      highPriorityUnmapped,
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      actorMappings: this.actorMap.size,
      publisherMappings: this.publisherMap.size,
      unmappedActors: this.unmappedActors.size,
      unmappedPublishers: this.unmappedPublishers.size,
      aliasIndex: this.actorAliasToMain.size,
    }
  }
}

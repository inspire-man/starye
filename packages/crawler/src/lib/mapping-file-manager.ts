/* eslint-disable no-console */
import type { R2Config } from './image-processor'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import * as v from 'valibot'
import { R2ConfigSchema } from './image-processor'

/**
 * R2 映射文件管理器
 *
 * 用途：
 * - 上传名字映射表到 R2（.actor-name-map.json, .publisher-name-map.json）
 * - 上传未匹配清单到 R2（.unmapped-actors.json, .unmapped-publishers.json）
 * - 支持版本管理和历史备份
 */

interface MappingMetadata {
  version: string
  uploadedAt: number
  totalEntries: number
  source: 'index-crawler' | 'manual' | 'api'
}

export class MappingFileManager {
  private s3: S3Client
  private bucket: string
  private publicUrl: string

  constructor(config: R2Config) {
    const validation = v.safeParse(R2ConfigSchema, config)
    if (!validation.success) {
      const errorMessage = validation.issues.map(issue => `  - ${issue.path?.join('.')}: ${issue.message}`).join('\n')
      throw new Error(
        `R2 配置无效:\n${errorMessage}\n\n`
        + '请检查 R2 相关环境变量。',
      )
    }

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    this.bucket = config.bucketName
    this.publicUrl = config.publicUrl
  }

  /**
   * 上传映射文件到 R2
   *
   * @param fileName 文件名（如 'actor-name-map.json'）
   * @param data 映射数据对象
   * @param metadata 元数据（版本、来源等）
   * @param backup 是否同时创建备份（默认 true）
   */
  async uploadMapping(
    fileName: string,
    data: any,
    metadata: Partial<MappingMetadata> = {},
    backup = true,
  ): Promise<{ key: string, url: string, version: string }> {
    const version = metadata.version || new Date().toISOString()
    const uploadedAt = metadata.uploadedAt || Date.now()
    const totalEntries = metadata.totalEntries || Object.keys(data).length

    const payload = {
      metadata: {
        version,
        uploadedAt,
        totalEntries,
        source: metadata.source || 'index-crawler',
      },
      data,
    }

    const key = `mappings/${fileName}`

    // 上传主文件
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: 'application/json',
    }))

    console.log(`✅ 已上传映射文件: ${key}`)
    console.log(`   版本: ${version}`)
    console.log(`   条目数: ${totalEntries}`)

    // 创建备份（带时间戳）
    if (backup) {
      const backupKey = `mappings/backups/${fileName.replace('.json', '')}-${Date.now()}.json`
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: backupKey,
        Body: JSON.stringify(payload, null, 2),
        ContentType: 'application/json',
      }))
      console.log(`📦 已创建备份: ${backupKey}`)
    }

    return {
      key,
      url: `${this.publicUrl}/${key}`,
      version,
    }
  }

  /**
   * 上传未匹配清单到 R2
   *
   * @param type 'actors' 或 'publishers'
   * @param unmappedList 未匹配清单数组
   */
  async uploadUnmappedList(
    type: 'actors' | 'publishers',
    unmappedList: any[],
  ): Promise<{ key: string, url: string }> {
    const fileName = type === 'actors' ? 'unmapped-actors.json' : 'unmapped-publishers.json'

    return this.uploadMapping(
      fileName,
      unmappedList,
      {
        totalEntries: unmappedList.length,
        source: 'index-crawler',
      },
    )
  }

  /**
   * 批量上传所有映射文件
   *
   * @param mappingFiles - 映射文件内容对象
   * @param mappingFiles.actorNameMap - 女优名字映射表
   * @param mappingFiles.publisherNameMap - 厂商名字映射表
   * @param mappingFiles.seriesToPublisher - 系列→厂商映射表
   * @param mappingFiles.unmappedActors - 未匹配女优清单
   * @param mappingFiles.unmappedPublishers - 未匹配厂商清单
   */
  async uploadAllMappings(mappingFiles: {
    actorNameMap?: Record<string, any>
    publisherNameMap?: Record<string, any>
    seriesToPublisher?: Record<string, string>
    unmappedActors?: any[]
    unmappedPublishers?: any[]
  }): Promise<void> {
    console.log('\n📤 批量上传映射文件到 R2...')

    const tasks = []

    if (mappingFiles.actorNameMap) {
      tasks.push(
        this.uploadMapping('actor-name-map.json', mappingFiles.actorNameMap)
          .then(() => console.log('  ✅ 女优名字映射表')),
      )
    }

    if (mappingFiles.publisherNameMap) {
      tasks.push(
        this.uploadMapping('publisher-name-map.json', mappingFiles.publisherNameMap)
          .then(() => console.log('  ✅ 厂商名字映射表')),
      )
    }

    if (mappingFiles.seriesToPublisher) {
      tasks.push(
        this.uploadMapping('series-to-publisher-map.json', mappingFiles.seriesToPublisher)
          .then(() => console.log('  ✅ 系列→厂商映射表')),
      )
    }

    if (mappingFiles.unmappedActors) {
      tasks.push(
        this.uploadUnmappedList('actors', mappingFiles.unmappedActors)
          .then(() => console.log('  ✅ 未匹配女优清单')),
      )
    }

    if (mappingFiles.unmappedPublishers) {
      tasks.push(
        this.uploadUnmappedList('publishers', mappingFiles.unmappedPublishers)
          .then(() => console.log('  ✅ 未匹配厂商清单')),
      )
    }

    await Promise.all(tasks)

    console.log('\n✅ 所有映射文件上传完成')
  }
}

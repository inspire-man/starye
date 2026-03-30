/* eslint-disable node/prefer-global/buffer */
import type { Database } from '@starye/db'
import { aria2Configs } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// Aria2 配置数据（返回给前端）
export interface Aria2ConfigData {
  id: string
  rpcUrl: string
  hasSecret: boolean
  useProxy: boolean
}

// 简单的 XOR 加密/解密（对称加密）
// 注意：这不是高强度加密，仅用于混淆存储。生产环境建议使用 Cloudflare Workers Secret
const ENCRYPTION_KEY = 'starye-aria2-secret-key-2024' // 应该从环境变量读取

function encryptSecret(secret: string): string {
  if (!secret)
    return ''
  const result: number[] = []
  for (let i = 0; i < secret.length; i++) {
    result.push(secret.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
  }
  return Buffer.from(result).toString('base64')
}

function decryptSecret(encrypted: string): string {
  if (!encrypted)
    return ''
  const bytes = Buffer.from(encrypted, 'base64')
  const result: string[] = []
  for (let i = 0; i < bytes.length; i++) {
    result.push(String.fromCharCode(bytes[i] ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)))
  }
  return result.join('')
}

// 获取用户的 Aria2 配置
export async function getUserAria2Config(options: {
  db: Database
  userId: string
}): Promise<Aria2ConfigData | null> {
  const { db, userId } = options

  const config = await db.query.aria2Configs.findFirst({
    where: eq(aria2Configs.userId, userId),
  })

  if (!config) {
    return null
  }

  return {
    id: config.id,
    rpcUrl: config.rpcUrl,
    hasSecret: !!config.secret,
    useProxy: config.useProxy || false,
  }
}

// 保存或更新用户的 Aria2 配置
export async function saveAria2Config(options: {
  db: Database
  userId: string
  rpcUrl: string
  secret?: string
  useProxy?: boolean
}): Promise<Aria2ConfigData> {
  const { db, userId, rpcUrl, secret, useProxy = false } = options

  // 验证 RPC URL 格式
  if (!rpcUrl || !/^https?:\/\/.+/.test(rpcUrl)) {
    throw new Error('无效的 RPC URL 格式')
  }

  const now = new Date()

  // 检查是否已存在配置
  const existing = await db.query.aria2Configs.findFirst({
    where: eq(aria2Configs.userId, userId),
  })

  const encryptedSecret = secret ? encryptSecret(secret) : null

  if (existing) {
    // 更新现有配置
    await db.update(aria2Configs)
      .set({
        rpcUrl,
        secret: secret !== undefined ? encryptedSecret : existing.secret, // 如果没传 secret，保持原值
        useProxy,
        updatedAt: now,
      })
      .where(eq(aria2Configs.id, existing.id))

    return {
      id: existing.id,
      rpcUrl,
      hasSecret: !!(secret || existing.secret),
      useProxy,
    }
  }
  else {
    // 插入新配置
    const configId = nanoid()
    await db.insert(aria2Configs).values({
      id: configId,
      userId,
      rpcUrl,
      secret: encryptedSecret,
      useProxy,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id: configId,
      rpcUrl,
      hasSecret: !!secret,
      useProxy,
    }
  }
}

// 获取解密后的完整配置（仅用于后端代理）
export async function getDecryptedAria2Config(options: {
  db: Database
  userId: string
}): Promise<{ rpcUrl: string, secret: string | null } | null> {
  const { db, userId } = options

  const config = await db.query.aria2Configs.findFirst({
    where: eq(aria2Configs.userId, userId),
  })

  if (!config) {
    return null
  }

  return {
    rpcUrl: config.rpcUrl,
    secret: config.secret ? decryptSecret(config.secret) : null,
  }
}

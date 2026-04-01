/**
 * Feature Flag 管理
 *
 * 用于灰度发布和功能开关
 */

import type { Context } from 'hono'

export interface FeatureFlag {
  name: string
  enabled: boolean
  enabledFor?: string[] // 特定用户 ID 列表
  enabledPercent?: number // 启用百分比（0-100）
  description?: string
}

/**
 * 默认 Feature Flags
 */
const defaultFlags: Record<string, FeatureFlag> = {
  'aria2-integration': {
    name: 'aria2-integration',
    enabled: true,
    description: 'Aria2 下载管理集成',
  },
  'quality-rating': {
    name: 'quality-rating',
    enabled: true,
    description: '播放源质量评分系统',
  },
  'rating-auto-score': {
    name: 'rating-auto-score',
    enabled: true,
    description: '自动评分算法',
  },
  'aria2-websocket': {
    name: 'aria2-websocket',
    enabled: true,
    description: 'Aria2 WebSocket 实时通知',
  },
}

/**
 * 从环境变量加载 Feature Flags
 *
 * 注意：Cloudflare Workers 环境中没有 process.env
 * 环境变量应通过 wrangler.toml 的 [vars] 配置或 Cloudflare Dashboard 设置
 */
function loadFlagsFromEnv(env?: Record<string, string>): Record<string, FeatureFlag> {
  const flags = { ...defaultFlags }

  // 如果没有提供环境变量，直接返回默认配置（所有功能启用）
  if (!env) {
    return flags
  }

  // 从环境变量读取配置（格式：FEATURE_FLAG_<NAME>=true|false）
  for (const key of Object.keys(env)) {
    if (key.startsWith('FEATURE_FLAG_')) {
      const flagName = key
        .replace('FEATURE_FLAG_', '')
        .toLowerCase()
        .replace(/_/g, '-')

      const value = env[key]

      if (flags[flagName]) {
        flags[flagName].enabled = value === 'true'
      }
    }
  }

  return flags
}

// 全局 flags 实例（默认全部启用）
let currentFlags = loadFlagsFromEnv()

/**
 * 检查功能是否启用
 */
export function isFeatureEnabled(
  featureName: string,
  userId?: string,
): boolean {
  const flag = currentFlags[featureName]

  if (!flag) {
    console.warn(`未知的 Feature Flag: ${featureName}`)
    return false
  }

  // 如果整体禁用
  if (!flag.enabled) {
    return false
  }

  // 如果指定了用户白名单
  if (flag.enabledFor && flag.enabledFor.length > 0) {
    return userId ? flag.enabledFor.includes(userId) : false
  }

  // 如果指定了启用百分比
  if (flag.enabledPercent !== undefined && userId) {
    const hash = simpleHash(userId)
    const percent = hash % 100
    return percent < flag.enabledPercent
  }

  return true
}

/**
 * 简单哈希函数（用于灰度发布）
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * 更新 Feature Flag
 */
export function updateFeatureFlag(flag: Partial<FeatureFlag> & { name: string }) {
  if (!currentFlags[flag.name]) {
    console.warn(`未知的 Feature Flag: ${flag.name}`)
    return
  }

  currentFlags[flag.name] = {
    ...currentFlags[flag.name],
    ...flag,
  }
}

/**
 * 获取所有 Feature Flags
 */
export function getAllFeatureFlags(): Record<string, FeatureFlag> {
  return { ...currentFlags }
}

/**
 * 重新加载 Feature Flags
 */
export function reloadFeatureFlags(env?: Record<string, string>) {
  currentFlags = loadFlagsFromEnv(env)
}

/**
 * Hono 中间件：检查 Feature Flag
 */
export function requireFeature(featureName: string) {
  return async (c: Context, next: () => Promise<void>) => {
    // 获取当前用户 ID
    const auth = c.get('auth')
    const session = await auth?.api?.getSession({ headers: c.req.raw.headers })
    const userId = session?.user?.id

    if (!isFeatureEnabled(featureName, userId)) {
      return c.json({
        code: 403,
        message: '此功能暂未开放',
      }, 403)
    }

    await next()
  }
}

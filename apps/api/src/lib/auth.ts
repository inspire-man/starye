import { createDb } from '@starye/db'
import * as schema from '@starye/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { getAllowedOrigins } from '../config'

// 定义环境类型
export interface Env {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
  CRAWLER_SECRET: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  WEB_URL?: string
  ADMIN_URL?: string
  // R2 Configuration
  CLOUDFLARE_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  R2_PUBLIC_URL: string // e.g. https://cdn.starye.com
}

// 解耦 Context，只依赖 Env 和 Request
export function createAuth(env: Env, request: Request) {
  const db = createDb(env.DB)

  // 动态获取 BaseURL
  const url = new URL(request.url)

  // 检查是否通过 Gateway 转发 (如果有自定义 Header)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const origin = forwardedHost ? `${protocol}://${forwardedHost}` : `${url.protocol}//${url.host}`

  // 核心：Better Auth 的 baseURL 必须指向它自己挂载的端点
  const baseURL = env.BETTER_AUTH_URL || `${origin}/api/auth`
  const isHttps = url.protocol === 'https:' || forwardedHost?.startsWith('https')

  // eslint-disable-next-line no-console
  console.log(`[Auth] Initializing with baseURL: ${baseURL} (Env: ${env.BETTER_AUTH_URL}, Origin: ${origin}, Secure: ${isHttps})`)

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    user: {
      additionalFields: {
        role: { type: 'string' },
        isAdult: { type: 'boolean' },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    // 允许前端跨域访问
    trustedOrigins: getAllowedOrigins(env),
    advanced: {
      cookiePrefix: 'starye',
      // Cloudflare Workers 必须的默认配置
      defaultCookieAttributes: {
        sameSite: isHttps ? 'none' : 'lax',
        secure: isHttps,
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

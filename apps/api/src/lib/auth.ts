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
  R2_PUBLIC_URL: string
}

// 解耦 Context，只依赖 Env 和 Request
export function createAuth(env: Env, request: Request) {
  const db = createDb(env.DB)

  // 动态获取 BaseURL
  const url = new URL(request.url)

  // 检查是否通过 Gateway 转发
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const origin = forwardedHost ? `${forwardedProto || 'https'}://${forwardedHost}` : `${url.protocol}//${url.host}`

  // 核心：Better Auth 的 baseURL 必须指向它自己挂载的端点
  const baseURL = env.BETTER_AUTH_URL || `${origin}/api/auth`
  const isHttps = url.protocol === 'https:' || forwardedProto === 'https'

  const cookieDomain = (env.WEB_URL && !isLocalDev)
    ? new URL(env.WEB_URL).hostname.replace('www.', '')
    : undefined

  const trustedOrigins = getAllowedOrigins(env)
  // eslint-disable-next-line no-console
  console.log(`[Auth Debug] baseURL=${baseURL}, isHttps=${isHttps}, cookieDomain=${cookieDomain}, origin=${origin}, forwardedHost=${forwardedHost}`)

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
    callbacks: {
      session: async ({ session, user }: { session: schema.Session, user: schema.User }) => {
        return {
          session,
          user: {
            ...user,
            isAdult: !!user.isAdult,
          },
        }
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
    trustedOrigins,
    advanced: {
      cookiePrefix: 'starye',
      // Cloudflare Workers 必须的默认配置
      defaultCookieAttributes: {
        // 在顶级域名共享时，Lax 是最合适的（比 None 更安全，且不需要跨站点权限）
        sameSite: isLocalDev ? 'lax' : (isHttps ? 'lax' : 'lax'),
        secure: isHttps,
        domain: cookieDomain,
        path: '/', // 极其重要：确保 Cookie 在 /comic, /movie 等路径下也有效
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

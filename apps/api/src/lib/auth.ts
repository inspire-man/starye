import { createDb } from '@starye/db'
import * as schema from '@starye/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

// 定义环境类型
export interface Env {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
  CRAWLER_SECRET: string // Added this
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  WEB_URL?: string
  ADMIN_URL?: string
}

// 解耦 Context，只依赖 Env 和 Request
export function createAuth(env: Env, request: Request) {
  const db = createDb(env.DB)

  // 动态获取 BaseURL (优先环境变量，回退到请求 Origin)
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`
  const baseURL = env.BETTER_AUTH_URL || origin

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
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    // 允许前端跨域访问
    trustedOrigins: [
      env.WEB_URL,
      env.ADMIN_URL,
      'http://localhost:3000', // Nuxt dev
      'http://localhost:5173', // Vite dev
    ].filter(Boolean) as string[],
    advanced: {
      cookiePrefix: 'starye',
      // Cloudflare Workers 必须的默认配置
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

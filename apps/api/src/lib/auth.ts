import { createDb } from '@starye/db'
import * as schema from '@starye/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI } from 'better-auth/plugins'

import { getAllowedOrigins } from '../config'

// Move regex to module scope to avoid re-compilation
const IP_ADDRESS_REGEX = /\d+\.\d+\.\d+\.\d+/
const AUTH_BASE_PATH = '/api/auth'

export const GITHUB_APP_CONFIGURATION_ERROR = 'github_app_configuration_missing' as const
export const GITHUB_APP_BINDING_NAMES = [
  'GITHUB_APP_ID',
  'GITHUB_APP_INSTALLATION_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_ACTIONS_OWNER',
  'GITHUB_ACTIONS_REPOSITORY',
  'GITHUB_ACTIONS_ENVIRONMENT',
  'GITHUB_ACTIONS_RUNNER_EVENT_CALLBACK_URL',
] as const

export type GitHubAppBindingName = typeof GITHUB_APP_BINDING_NAMES[number]
export type GitHubAppBindingValidation
  = | { readonly ok: true }
    | {
      readonly code: typeof GITHUB_APP_CONFIGURATION_ERROR
      readonly missing: readonly GitHubAppBindingName[]
      readonly ok: false
    }

// 定义环境类型
export interface Env {
  DB: D1Database
  BUCKET: R2Bucket
  CACHE?: KVNamespace // 可选，如果未配置则缓存功能降级
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
  CRAWLER_SECRET: string
  TASK_RUNNER_CALLBACK_SECRET_CURRENT: string
  TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: string
  TASK_RUNNER_CALLBACK_SECRET_PREVIOUS?: string
  TASK_RUNNER_CALLBACK_KEY_ID_PREVIOUS?: string
  TASK_RUNNER_CALLBACK_PREVIOUS_ROTATED_AT?: string
  CRAWLER_LOCAL_PROOF_ENABLED?: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  // GitHub App provider bindings are optional until production orchestration is configured.
  GITHUB_APP_ID?: string
  GITHUB_APP_INSTALLATION_ID?: string
  GITHUB_APP_PRIVATE_KEY?: string // PKCS#8 PEM; secret value never enters DTOs, D1, logs, or receipts
  GITHUB_ACTIONS_OWNER?: string
  GITHUB_ACTIONS_REPOSITORY?: string
  GITHUB_ACTIONS_ENVIRONMENT?: string
  GITHUB_ACTIONS_RUNNER_EVENT_CALLBACK_URL?: string
  WEB_URL?: string
  ADMIN_URL?: string
  OPENROUTER_API_KEY?: string
  QUANT_DATA_PROVIDER?: string
  TUSHARE_TOKEN?: string
  TUSHARE_POINTS_TIER?: string
  TUSHARE_BASE_URL?: string
  TUSHARE_TIMEOUT_MS?: string
  EASTMONEY_BASE_URL?: string
  EASTMONEY_DIVIDEND_BASE_URL?: string
  EASTMONEY_TIMEOUT_MS?: string
  QUANT_AI_ENCRYPTION_KEY?: string
  QUANT_AKSHARE_BRIDGE_URL?: string
  QUANT_AKSHARE_BRIDGE_TOKEN?: string
  QUANT_AKSHARE_BRIDGE_TIMEOUT_MS?: string
  QUANT_AI_GENERATION_TIMEOUT_MS?: string
  ADMIN_GITHUB_ID?: string // 逗号分隔的 GitHub ID 白名单
  SENTRY_DSN?: string
  SENTRY_RELEASE?: string
  // R2 Configuration
  CLOUDFLARE_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  R2_PUBLIC_URL: string
}

/** Reports missing GitHub App bindings by name only, so provider clients can fail closed without exposing values. */
export function validateGitHubAppBindings(env: Pick<Env, GitHubAppBindingName>): GitHubAppBindingValidation {
  const missing = GITHUB_APP_BINDING_NAMES.filter(name => !env[name]?.trim())
  if (missing.length > 0) {
    return {
      code: GITHUB_APP_CONFIGURATION_ERROR,
      missing,
      ok: false,
    }
  }

  return { ok: true }
}

/**
 * 将 GitHub ID 注入 session user 对象。
 * 提取为纯函数以便单元测试。
 * @param userId - Better Auth user.id
 * @param githubAccount - account 表查询结果（providerId='github' 的记录）
 */
export function injectGithubIdIntoSession(
  userId: string,
  githubAccount: { accountId: string } | undefined,
): string | null {
  return githubAccount?.accountId ?? null
}

/** Keep Better Auth's base URL and the provider callback on the same mounted endpoint. */
export function resolveAuthBaseURL(configuredURL: string | undefined, requestOrigin: string): string {
  const candidate = configuredURL?.trim() || `${requestOrigin}${AUTH_BASE_PATH}`
  const url = new URL(candidate)

  if (!url.pathname || url.pathname === '/') {
    url.pathname = AUTH_BASE_PATH
  }

  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/u, '')
}

// 解耦 Context，只依赖 Env 和 Request
export function createAuth(env: Env, request: Request) {
  const db = createDb(env.DB)

  // 动态获取 BaseURL
  const url = new URL(request.url)

  // OAuth provider callback 必须指向 API Worker，而不是浏览器看到的 Gateway host。
  // Gateway 转发时 request.url 仍保留 API Worker origin；x-forwarded-host 只代表外部入口。
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const requestOrigin = `${url.protocol}//${url.host}`

  // 核心：Better Auth 的 baseURL 必须指向它自己挂载的端点
  const baseURL = resolveAuthBaseURL(env.BETTER_AUTH_URL, requestOrigin)
  const githubRedirectURI = `${baseURL}/callback/github`
  const isHttps = url.protocol === 'https:' || forwardedProto === 'https'

  const originHostname = new URL(baseURL).hostname
  const isLocalDev = originHostname === 'localhost' || originHostname === '127.0.0.1' || originHostname === '[::1]' || !!originHostname.match(IP_ADDRESS_REGEX)

  const cookieDomain = (env.WEB_URL && !isLocalDev)
    ? new URL(env.WEB_URL).hostname.replace('www.', '')
    : undefined

  const trustedOrigins = getAllowedOrigins(env)

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
        isR18Verified: { type: 'boolean' },
        githubId: { type: 'string' },
      },
    },
    callbacks: {
      session: async ({ session, user }: { session: schema.Session, user: schema.User }) => {
        // 从 account 表查询 GitHub ID（providerId='github' 的 accountId）
        const githubAccount = await db.query.account.findFirst({
          where: (a, { and, eq }) => and(
            eq(a.userId, user.id),
            eq(a.providerId, 'github'),
          ),
        })
        return {
          session,
          user: {
            ...user,
            isAdult: !!user.isAdult,
            isR18Verified: !!user.isR18Verified,
            githubId: injectGithubIdIntoSession(user.id, githubAccount ?? undefined),
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
        redirectURI: githubRedirectURI,
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
    plugins: [
      openAPI(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

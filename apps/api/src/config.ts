import type { Env } from './lib/auth'

export function getAllowedOrigins(env: Env): string[] {
  const origins = new Set<string>([
    'https://starye.org',
    'https://www.starye.org',
    'http://starye.org',
    'http://starye.org:8080',
    'http://localhost:3003',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3003',
  ])

  if (env.WEB_URL) {
    origins.add(env.WEB_URL)
    // 自动添加 HTTP 版本
    if (env.WEB_URL.startsWith('https://')) {
      origins.add(env.WEB_URL.replace('https://', 'http://'))
    }
  }

  if (env.ADMIN_URL) {
    origins.add(env.ADMIN_URL)
    if (env.ADMIN_URL.startsWith('https://')) {
      origins.add(env.ADMIN_URL.replace('https://', 'http://'))
    }
  }

  return [...origins].filter((url): url is string => !!url)
}

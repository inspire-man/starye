import type { Env } from './lib/auth'

export function getAllowedOrigins(env: Env): string[] {
  return [
    env.WEB_URL,
    env.ADMIN_URL,
    env.BETTER_AUTH_URL,
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ].filter((url): url is string => Boolean(url))
}

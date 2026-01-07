import type { Env } from './lib/auth'

export function getAllowedOrigins(env: Env): string[] {
  return [
    env.WEB_URL,
    env.ADMIN_URL,
    'http://localhost:3000', // Nuxt dev
    'http://localhost:5173', // Vite dev
    'http://localhost:8080', // Gateway dev
  ].filter((url): url is string => !!url)
}

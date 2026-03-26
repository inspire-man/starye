import type { Database } from '@starye/db'
import type { Auth, Env } from './lib/auth'

// Hono Variables
export interface Variables {
  db: Database
  auth: Auth
  user?: SessionUser
}

export interface AppEnv { Bindings: Env, Variables: Variables }

// Extended User Type for Application
export interface SessionUser {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image?: string | null
  createdAt: Date
  updatedAt: Date
  role: string
  isAdult: boolean
  isR18Verified: boolean
}

// 爬虫相关的验证 schemas 已迁移到 schemas/crawler.ts
export type {
  ChapterContentInput,
  ChapterInput,
  MangaInfoInput,
  MovieInfoInput,
} from './schemas/crawler'

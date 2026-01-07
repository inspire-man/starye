import type { Database } from '@starye/db'
import type { Auth, Env } from './lib/auth'
import { z } from 'zod'

// Hono Variables
export interface Variables {
  db: Database
  auth: Auth
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
  isAdult: boolean // Custom field
}

// Validation Schemas
export const ChapterSchema = z.object({
  title: z.string(),
  slug: z.string(),
  url: z.string(),
  number: z.number(),
})

export const MangaInfoSchema = z.object({
  title: z.string(),
  slug: z.string(),
  cover: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  chapters: z.array(ChapterSchema),
})

export type ChapterInput = z.infer<typeof ChapterSchema>
export type MangaInfoInput = z.infer<typeof MangaInfoSchema>

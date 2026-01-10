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
  role: string // Custom field
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
  status: z.enum(['serializing', 'completed']).or(z.string()).optional(),
  isR18: z.boolean().optional(),
  sourceUrl: z.string().optional(),
  region: z.string().optional(),
  genres: z.array(z.string()).optional(),
  chapters: z.array(ChapterSchema),
})

export const ChapterContentSchema = z.object({
  comicSlug: z.string(),
  chapterSlug: z.string(),
  title: z.string(),
  images: z.array(z.string()), // Array of image URLs (already uploaded)
  width: z.number().optional(),
  height: z.number().optional(),
})

export const MovieInfoSchema = z.object({
  title: z.string(),
  slug: z.string(),
  code: z.string(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  releaseDate: z.number().optional(), // timestamp in seconds
  duration: z.number().optional(),
  sourceUrl: z.string(),
  actors: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  series: z.string().optional(),
  publisher: z.string().optional(),
  isR18: z.boolean().default(true),
  players: z.array(z.object({
    sourceName: z.string(),
    sourceUrl: z.string(),
    quality: z.string().optional(),
    sortOrder: z.number(),
  })),
})

export type ChapterInput = z.infer<typeof ChapterSchema>
export type MangaInfoInput = z.infer<typeof MangaInfoSchema>
export type ChapterContentInput = z.infer<typeof ChapterContentSchema>
export type MovieInfoInput = z.infer<typeof MovieInfoSchema>

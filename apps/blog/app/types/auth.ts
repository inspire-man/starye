// Extend Better Auth types to include custom fields from our database schema
export interface ExtendedUser {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image?: string
  role?: 'user' | 'admin' | 'super_admin' | 'movie_admin' | 'comic_admin'
  isAdult?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ExtendedSession {
  user: ExtendedUser
  session: {
    id: string
    userId: string
    expiresAt: Date
    token: string
    ipAddress?: string
    userAgent?: string
  }
}

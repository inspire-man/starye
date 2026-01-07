// Extend Better Auth types to include custom fields from our database schema
export interface ExtendedUser {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image?: string
  role?: 'user' | 'admin'
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

// Type guard to check if session data exists
export function hasSessionData(session: any): session is { data: ExtendedSession } {
  return session?.data?.user !== undefined
}

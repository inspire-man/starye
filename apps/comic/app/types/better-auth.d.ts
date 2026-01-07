// TypeScript module augmentation for Better Auth
// This extends Better Auth's default types to include our custom fields

declare module 'better-auth' {
  interface User {
    role?: 'user' | 'admin'
  }
}

declare module 'better-auth/vue' {
  interface User {
    role?: 'user' | 'admin'
  }
}

export {}

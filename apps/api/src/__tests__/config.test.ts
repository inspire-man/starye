import { describe, expect, it } from 'vitest'
import { getAllowedOrigins } from '../config'

describe('getAllowedOrigins', () => {
  it('uses selected runtime origins plus canonical local Gateway only', () => {
    const origins = getAllowedOrigins({
      WEB_URL: 'https://alternate.example',
      ADMIN_URL: 'https://dashboard.alternate.example',
      BETTER_AUTH_URL: 'https://auth.alternate.example',
    } as never)

    expect(origins).toEqual(expect.arrayContaining([
      'https://alternate.example',
      'https://dashboard.alternate.example',
      'https://auth.alternate.example',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ]))
    expect(origins.join(' ')).not.toMatch(/starye\.org|localhost:(3000|3001|3002|3003|5173)/)
  })
})

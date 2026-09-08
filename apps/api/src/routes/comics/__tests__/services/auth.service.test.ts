import { describe, expect, it } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { checkUserAdultStatus } from '../../services/auth.service'

describe('comic media access', () => {
  it('requires verification for anonymous users', () => {
    expect(checkUserAdultStatus()).toBe(false)
  })

  it.each([
    { isAdult: false, isR18Verified: false, allowed: false },
    { isAdult: false, isR18Verified: true, allowed: true },
    { isAdult: true, isR18Verified: false, allowed: true },
    { isAdult: true, isR18Verified: true, allowed: true },
  ])('checks explicit verification flags: %j', ({ isAdult, isR18Verified, allowed }) => {
    expect(checkUserAdultStatus(createMockUser({ isAdult, isR18Verified }))).toBe(allowed)
  })

  it('does not grant media access from the admin role alone', () => {
    expect(checkUserAdultStatus(createMockUser({ role: 'admin', isAdult: false, isR18Verified: false }))).toBe(false)
  })
})

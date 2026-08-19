import { describe, expect, it } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { checkUserAdultStatus } from '../../services/auth.service'

describe('checkUserAdultStatus', () => {
  it('allows a user who completed age verification', () => {
    expect(checkUserAdultStatus(createMockUser({ isAdult: true }))).toBe(true)
  })

  it('allows a user on the R18 whitelist', () => {
    expect(checkUserAdultStatus(createMockUser({ isR18Verified: true }))).toBe(true)
  })

  it('denies anonymous and unverified users', () => {
    expect(checkUserAdultStatus()).toBe(false)
    expect(checkUserAdultStatus(createMockUser())).toBe(false)
  })
})

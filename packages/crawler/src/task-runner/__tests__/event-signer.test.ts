import { describe, expect, it } from 'vitest'
import { signRunnerBody } from '../event-signer'

describe('runner event signer', () => {
  it('signs the exact serialized body with a stable base64url HMAC', () => {
    expect(signRunnerBody('{"run_id":"run-1"}', 'runner-secret')).toBe(signRunnerBody('{"run_id":"run-1"}', 'runner-secret'))
    expect(signRunnerBody('{"run_id":"run-1"}', 'runner-secret')).not.toBe(signRunnerBody('{"run_id": "run-1"}', 'runner-secret'))
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildCrawlerOperationSnapshot,
  canonicalizeOperationCommand,
  classifyIdempotentOperation,
  fingerprintOperationCommand,
} from '../operation-registry'

function command() {
  return {
    actor: { id: 'admin-1', kind: 'admin' as const },
    idempotencyKey: 'operation-1',
    intent: { kind: 'crawl' as const },
    operation: 'movie' as const,
    policyReference: 'availability/default',
    policyVersion: 'v1',
    target: { id: 'movie-1', kind: 'movie' as const },
  }
}

describe('crawler operation registry', () => {
  it('accepts only the closed command and creates a server-owned provider snapshot', () => {
    const snapshot = buildCrawlerOperationSnapshot(command())
    expect(snapshot.provider.workflow).toBe('.github/workflows/daily-movie-crawl.yml')
    expect(snapshot.provider.repository).toBe('inspire-man/starye')
    expect(snapshot.requestSnapshotJson).not.toContain('command')
    expect(() => canonicalizeOperationCommand({ ...command(), workflow: 'caller-controlled' })).toThrow('unknown_field')
  })

  it('rejects unknown target, intent, operation and provider fields', () => {
    expect(() => canonicalizeOperationCommand({ ...command(), operation: 'video' })).toThrow('unknown')
    expect(() => canonicalizeOperationCommand({ ...command(), target: { id: 'x', kind: 'video' } })).toThrow('target')
    expect(() => canonicalizeOperationCommand({ ...command(), intent: { kind: 'crawl', command: 'run' } })).toThrow('unknown_field')
    expect(() => canonicalizeOperationCommand({ ...command(), provider: 'github-actions' })).toThrow('unknown_field')
  })

  it('keeps canonical fingerprint and snapshot JSON isolated from later mutation', () => {
    const input = command()
    const snapshot = buildCrawlerOperationSnapshot(input)
    input.target.id = 'mutated'
    input.intent.kind = 'crawl'
    expect(snapshot.target.id).toBe('movie-1')
    expect(snapshot.requestSnapshotJson).toContain('movie-1')
    expect(fingerprintOperationCommand(command())).toBe(snapshot.fingerprint)
  })

  it('distinguishes a new identity, exact replay and same-key conflict', () => {
    const fingerprint = fingerprintOperationCommand(command())
    expect(classifyIdempotentOperation({ candidate: { fingerprint, idempotencyKey: 'k' }, existing: null }).kind).toBe('new')
    expect(classifyIdempotentOperation({ candidate: { fingerprint, idempotencyKey: 'k' }, existing: { fingerprint, taskId: 'task-1' } })).toEqual({
      kind: 'duplicate',
      fingerprint,
      idempotencyKey: 'k',
      taskId: 'task-1',
    })
    expect(classifyIdempotentOperation({ candidate: { fingerprint: 'other', idempotencyKey: 'k' }, existing: { fingerprint, taskId: 'task-1' } }).kind).toBe('conflict')
  })
})

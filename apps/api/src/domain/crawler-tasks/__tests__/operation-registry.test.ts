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

function videoCommand(
  operation: 'check_video_source' | 'recheck_video_source' | 'repair_video_source',
  reason: 'no_source' | 'source_failed' | 'stale' | 'direct_blocked' | 'no_peer' | 'provider_failed',
) {
  return {
    actor: { id: 'admin-1', kind: 'admin' as const },
    idempotencyKey: `${operation}-${reason}-1`,
    intent: {
      kind: operation,
      movieRevision: 11,
      policyVersion: 'video-source-probe/v1',
      reason,
      sourceRevision: 7,
    },
    operation,
    policyReference: 'availability/video-source-probe',
    policyVersion: 'video-source-probe/v1',
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

  it.each([
    ['check_video_source', 'stale'],
    ['recheck_video_source', 'stale'],
    ['recheck_video_source', 'no_peer'],
    ['repair_video_source', 'no_source'],
    ['repair_video_source', 'source_failed'],
    ['repair_video_source', 'direct_blocked'],
  ] as const)('creates immutable revision-bound %s snapshots for %s', (operation, reason) => {
    const snapshot = buildCrawlerOperationSnapshot(videoCommand(operation, reason))

    expect(snapshot).toMatchObject({
      intent: {
        kind: operation,
        movieRevision: 11,
        policyVersion: 'video-source-probe/v1',
        reason,
        sourceRevision: 7,
      },
      operation,
      policyVersion: 'video-source-probe/v1',
      target: { id: 'movie-1', kind: 'movie' },
      template: {
        entrypoint: 'movie-crawler',
        movieId: 'movie-1',
        movieRevision: 11,
        operation,
        policyVersion: 'video-source-probe/v1',
        reason,
        sourceRevision: 7,
        templateKey: 'movie',
      },
    })
    expect(snapshot.provider.workflow).toBe('.github/workflows/daily-movie-crawl.yml')
    expect(snapshot.requestSnapshotJson).not.toContain('url')
    expect(snapshot.requestSnapshotJson).not.toContain('secret')
  })

  it('rejects unsupported video reason/action pairs and caller-owned execution fields', () => {
    expect(() => canonicalizeOperationCommand(videoCommand('repair_video_source', 'stale'))).toThrow('intent')
    expect(() => canonicalizeOperationCommand(videoCommand('recheck_video_source', 'no_source'))).toThrow('intent')
    expect(() => canonicalizeOperationCommand(videoCommand('check_video_source', 'provider_failed'))).toThrow('intent')
    expect(() => canonicalizeOperationCommand({ ...videoCommand('recheck_video_source', 'stale'), workflow: 'caller.yml' })).toThrow('unknown_field')
    expect(() => canonicalizeOperationCommand({
      ...videoCommand('recheck_video_source', 'stale'),
      intent: { ...videoCommand('recheck_video_source', 'stale').intent, providerConfig: { endpoint: 'http://localhost' } },
    })).toThrow('unknown_field')
  })

  it('includes revisions and policy in the idempotency fingerprint', () => {
    const base = videoCommand('recheck_video_source', 'stale')
    expect(fingerprintOperationCommand(base)).not.toBe(fingerprintOperationCommand({
      ...base,
      intent: { ...base.intent, sourceRevision: 8 },
    }))
    expect(fingerprintOperationCommand(base)).not.toBe(fingerprintOperationCommand({
      ...base,
      intent: { ...base.intent, movieRevision: 12 },
    }))
  })
})

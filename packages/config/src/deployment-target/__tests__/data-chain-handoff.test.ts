import type { TargetResolution } from '../target-resolver'
import { lstat, mkdtemp, open, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveTargetProfile } from '../target-resolver'

interface ResolvedDataChainHandoffRequest {
  readonly mode: 'local' | 'remote'
  readonly runId: string
  readonly resolution: TargetResolution
}

interface DataChainHandoffPaths {
  readonly root: string
  readonly directory: string
  readonly json: string
  readonly markdown: string
  readonly attempt: string
}

interface DataChainHandoffEvidencePair {
  readonly json: string
  readonly markdown: string
}

interface DataChainHandoffStorageAdapter {
  readonly inspectPair: (paths: DataChainHandoffPaths) => Promise<{ json: 'missing' | 'exists' | 'unavailable', markdown: 'missing' | 'exists' | 'unavailable' }>
  readonly readPair: (paths: DataChainHandoffPaths) => Promise<DataChainHandoffEvidencePair | undefined>
  readonly writePair: (paths: DataChainHandoffPaths, pair: DataChainHandoffEvidencePair) => Promise<'written' | 'unavailable'>
  readonly reserveAttempt: (paths: DataChainHandoffPaths) => Promise<'reserved' | 'exists' | 'unavailable'>
}

interface DataChainHandoffVerificationResult {
  readonly exitCode: 0 | 2
  readonly outcome: 'terminal_passed' | 'pending' | 'failed' | 'checkpoint'
  readonly provesExternalChain: boolean
  readonly evidence: {
    readonly mode: 'local' | 'remote'
    readonly targetId: string
    readonly runId: string
    readonly itemCode: string
    readonly itemId: string | null
    readonly ingestState: 'pre_ingest' | 'resolved_pending_observation' | 'resolved'
    readonly aggregate: 'pending' | 'checkpoint' | 'failed' | 'passed'
  }
}

interface DataChainHandoffDependencies {
  readonly storage: DataChainHandoffStorageAdapter
  readonly invokeRemotePreflight: (request: ResolvedDataChainHandoffRequest) => Promise<'passed' | 'unmet'>
  readonly invokeRunner: (request: ResolvedDataChainHandoffRequest) => Promise<void>
  readonly invokeVerifier: (request: ResolvedDataChainHandoffRequest, paths: DataChainHandoffPaths) => Promise<DataChainHandoffVerificationResult>
  readonly now?: () => string
}

interface HandoffModule {
  parseDataChainHandoffArgs: (argv: readonly string[]) => {
    mode: 'local' | 'remote'
    target: string
    runId: string
  }
  validateResolvedDataChainHandoffRequest: (
    input: { mode: 'local' | 'remote', target: string, runId: string },
    resolution: ReturnType<typeof resolveTargetProfile>,
  ) => ResolvedDataChainHandoffRequest | undefined
  assertExactDataChainHandoffPaths: (
    request: ResolvedDataChainHandoffRequest,
    root: string,
    candidate: DataChainHandoffPaths,
  ) => Promise<void>
  deriveDataChainHandoffPaths: (request: ResolvedDataChainHandoffRequest) => Promise<DataChainHandoffPaths>
  runDataChainHandoffCore: (
    request: ResolvedDataChainHandoffRequest,
    dependencies: DataChainHandoffDependencies,
  ) => Promise<{ exitCode: 0 | 1, outcome: string, handoffReady: boolean, preflightStatus: string, runnerInvocations: 0 | 1 }>
  runDataChainHandoffCli: (
    argv: readonly string[],
    dependencies?: {
      createDependencies?: (request: ResolvedDataChainHandoffRequest) => DataChainHandoffDependencies
      resultSink?: (result: { outcome: string, handoffReady: boolean }) => void
    },
  ) => Promise<0 | 1>
}

const temporaryRoots: string[] = []

async function loadHandoff(): Promise<HandoffModule> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/data-chain-handoff.ts', import.meta.url).href) as Promise<HandoffModule>
}

function pendingVerification(request: ResolvedDataChainHandoffRequest): DataChainHandoffVerificationResult {
  return {
    exitCode: 2,
    outcome: 'pending',
    provesExternalChain: false,
    evidence: {
      mode: request.mode,
      targetId: request.resolution.id,
      runId: request.runId,
      itemCode: 'p13-smoke-starye-org-test',
      itemId: 'movie-test-1',
      ingestState: 'resolved_pending_observation',
      aggregate: 'pending',
    },
  }
}

function checkpointVerification(request: ResolvedDataChainHandoffRequest): DataChainHandoffVerificationResult {
  return {
    exitCode: 2,
    outcome: 'checkpoint',
    provesExternalChain: false,
    evidence: {
      mode: request.mode,
      targetId: request.resolution.id,
      runId: request.runId,
      itemCode: 'p13-smoke-starye-org-test',
      itemId: null,
      ingestState: 'pre_ingest',
      aggregate: 'checkpoint',
    },
  }
}

/** Test-only adapter: logical paths are asserted before OS-temp mapping. */
export async function createTempMappedDataChainHandoffStorage(expected: DataChainHandoffPaths): Promise<{
  storage: DataChainHandoffStorageAdapter
  files: { json: string, markdown: string, attempt: string }
}> {
  expect(Object.isFrozen(expected)).toBe(true)
  const root = await mkdtemp(path.join(tmpdir(), 'starye-13-14-'))
  temporaryRoots.push(root)
  const files = {
    json: path.join(root, 'pair.json'),
    markdown: path.join(root, 'pair.md'),
    attempt: path.join(root, 'mode.attempt'),
  }
  const assertExact = (paths: DataChainHandoffPaths): void => {
    expect(paths).toEqual(expected)
    expect(Object.isFrozen(paths)).toBe(true)
  }
  const inspect = async (file: string): Promise<'missing' | 'exists' | 'unavailable'> => {
    try {
      await lstat(file)
      return 'exists'
    }
    catch (error) {
      return error instanceof Error && 'code' in error && error.code === 'ENOENT'
        ? 'missing'
        : 'unavailable'
    }
  }
  return {
    files,
    storage: {
      async inspectPair(paths) {
        assertExact(paths)
        const [json, markdown] = await Promise.all([inspect(files.json), inspect(files.markdown)])
        return { json, markdown }
      },
      async readPair(paths) {
        assertExact(paths)
        try {
          const [json, markdown] = await Promise.all([readFile(files.json, 'utf8'), readFile(files.markdown, 'utf8')])
          return { json, markdown }
        }
        catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return undefined
          }
          throw error
        }
      },
      async writePair(paths, pair) {
        assertExact(paths)
        await writeFile(files.json, pair.json, 'utf8')
        await writeFile(files.markdown, pair.markdown, 'utf8')
        return 'written'
      },
      async reserveAttempt(paths) {
        assertExact(paths)
        try {
          const handle = await open(files.attempt, 'wx')
          await handle.close()
          return 'reserved'
        }
        catch (error) {
          return error instanceof Error && 'code' in error && error.code === 'EEXIST'
            ? 'exists'
            : 'unavailable'
        }
      },
    },
  }
}

function resolvedRequest(handoff: HandoffModule, mode: 'local' | 'remote'): ResolvedDataChainHandoffRequest {
  const request = handoff.validateResolvedDataChainHandoffRequest({
    mode,
    target: 'starye-org',
    runId: `${mode}-20260719t000000z`,
  }, resolveTargetProfile('starye-org'))
  if (!request) {
    throw new Error('Expected test target resolution to be valid.')
  }
  return request
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('data-chain handoff parser and core', () => {
  it('accepts only the closed no-path mode, target, and run-id contract', async () => {
    const { parseDataChainHandoffArgs } = await loadHandoff()

    expect(parseDataChainHandoffArgs([
      '--mode',
      'local',
      '--target',
      'starye-org',
      '--run-id',
      'local-20260719t000000z',
    ])).toEqual({
      mode: 'local',
      target: 'starye-org',
      runId: 'local-20260719t000000z',
    })
    expect(() => parseDataChainHandoffArgs([
      '--mode',
      'local',
      '--target',
      'starye-org',
      '--run-id',
      'local-20260719t000000z',
      '--evidence-dir',
      '.planning/phases/13-full-chain-data-smoke/evidence',
    ])).toThrow('invalid_handoff_arguments')
  })

  it('rejects invalid target and evidence-dir input before its dependency factory', async () => {
    const { runDataChainHandoffCli } = await loadHandoff()
    const results: { outcome: string, handoffReady: boolean }[] = []
    let factories = 0

    for (const argv of [
      ['--mode', 'local', '--target', '../starye-org', '--run-id', 'local-20260719t000000z'],
      ['--mode', 'local', '--target', 'starye-org', '--run-id', 'local-20260719t000000z', '--evidence-dir=elsewhere'],
    ]) {
      await expect(runDataChainHandoffCli(argv, {
        createDependencies: () => {
          factories += 1
          throw new Error('factory must not run')
        },
        resultSink: result => results.push(result),
      })).resolves.toBe(1)
    }

    expect(factories).toBe(0)
    expect(results).toMatchObject([
      { outcome: 'invalid_target', handoffReady: false },
      { outcome: 'invalid_target', handoffReady: false },
    ])
    expect(results.join()).not.toContain('../starye-org')
  })

  it('keeps path and data-chain owners out of the static prelude', async () => {
    const source = await readFile(new URL('../../../../../scripts/data-chain-handoff.ts', import.meta.url), 'utf8')

    expect(source).not.toMatch(/^import .*node:(?:path|fs(?:\/promises)?)/m)
    expect(source).not.toMatch(/^import .*data-chain-smoke/m)
    expect(source).not.toMatch(/^import .*verify-data-chain-smoke/m)
    expect(source).not.toMatch(/^import .*data-chain-evidence/m)
  })

  it('resolves the canonical target before creating valid-request dependencies', async () => {
    const handoff = await loadHandoff()
    const expected = resolvedRequest(handoff, 'local')
    const paths = await handoff.deriveDataChainHandoffPaths(expected)
    const { storage } = await createTempMappedDataChainHandoffStorage(paths)
    const events: string[] = []

    await expect(handoff.runDataChainHandoffCli([
      '--mode',
      'local',
      '--target',
      'starye-org',
      '--run-id',
      'local-20260719t000000z',
    ], {
      createDependencies: (request) => {
        events.push(`factory:${request.resolution.id}`)
        return {
          storage,
          invokeRemotePreflight: async () => 'passed',
          invokeRunner: async () => { events.push('runner') },
          invokeVerifier: async () => {
            events.push('verifier')
            return pendingVerification(request)
          },
        }
      },
      resultSink: result => events.push(`result:${result.outcome}`),
    })).resolves.toBe(0)
    expect(events).toEqual(['factory:starye-org', 'runner', 'verifier', 'result:pending'])
  })

  it('rejects forged resolved requests before derivation or storage', async () => {
    const handoff = await loadHandoff()
    const valid = resolvedRequest(handoff, 'local')
    const forged = Object.freeze({
      ...valid,
      resolution: {
        ...valid.resolution,
        profile: { ...valid.resolution.profile, id: 'different-target' },
      },
    }) as unknown as ResolvedDataChainHandoffRequest
    let storageCalls = 0
    const storage: DataChainHandoffStorageAdapter = {
      inspectPair: async () => {
        storageCalls += 1
        return { json: 'missing', markdown: 'missing' }
      },
      readPair: async () => undefined,
      writePair: async () => 'written',
      reserveAttempt: async () => 'reserved',
    }

    await expect(handoff.runDataChainHandoffCore(forged, {
      storage,
      invokeRemotePreflight: async () => 'passed',
      invokeRunner: async () => undefined,
      invokeVerifier: async () => pendingVerification(valid),
    })).resolves.toMatchObject({ outcome: 'invalid_target', runnerInvocations: 0 })
    expect(storageCalls).toBe(0)
  })

  it('rejects a swapped or escaped bundle through the exact fixed-root guard', async () => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'local')
    const paths = await handoff.deriveDataChainHandoffPaths(request)

    await expect(handoff.assertExactDataChainHandoffPaths(request, paths.root, Object.freeze({
      ...paths,
      json: paths.markdown,
    }))).rejects.toThrow('invalid_evidence_path')
    await expect(handoff.assertExactDataChainHandoffPaths(request, paths.root, Object.freeze({
      ...paths,
      attempt: path.join(paths.root, 'remote.attempt'),
    }))).rejects.toThrow('invalid_evidence_path')
  })

  it('derives one frozen bundle, reserves exactly once, and accepts only an exact pending verifier result', async () => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'local')
    const paths = await handoff.deriveDataChainHandoffPaths(request)
    const { storage, files } = await createTempMappedDataChainHandoffStorage(paths)
    let runners = 0
    let verifiers = 0

    const result = await handoff.runDataChainHandoffCore(request, {
      storage,
      invokeRemotePreflight: async () => 'passed',
      invokeRunner: async () => { runners += 1 },
      invokeVerifier: async () => {
        verifiers += 1
        return pendingVerification(request)
      },
    })

    expect(result).toMatchObject({
      exitCode: 0,
      outcome: 'pending',
      handoffReady: true,
      preflightStatus: 'not_applicable',
      runnerInvocations: 1,
    })
    expect(runners).toBe(1)
    expect(verifiers).toBe(1)
    await expect(stat(files.attempt)).resolves.toMatchObject({ size: 0 })
    await expect(handoff.runDataChainHandoffCore(request, {
      storage,
      invokeRemotePreflight: async () => 'passed',
      invokeRunner: async () => { throw new Error('must not run') },
      invokeVerifier: async () => pendingVerification(request),
    })).resolves.toMatchObject({ outcome: 'attempt_already_reserved', runnerInvocations: 0 })
  })

  it('writes a redacted remote preflight checkpoint without invoking the runner', async () => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'remote')
    const paths = await handoff.deriveDataChainHandoffPaths(request)
    const { storage, files } = await createTempMappedDataChainHandoffStorage(paths)
    let runners = 0
    let verifiers = 0

    const result = await handoff.runDataChainHandoffCore(request, {
      storage,
      invokeRemotePreflight: async () => 'unmet',
      invokeRunner: async () => { runners += 1 },
      invokeVerifier: async () => {
        verifiers += 1
        return checkpointVerification(request)
      },
      now: () => '2026-07-19T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      exitCode: 1,
      outcome: 'handoff_not_ready',
      preflightStatus: 'unmet',
      runnerInvocations: 0,
    })
    expect(runners).toBe(0)
    expect(verifiers).toBe(1)
    await expect(readFile(files.json, 'utf8')).resolves.toContain('"itemId": null')
    await expect(readFile(files.json, 'utf8')).resolves.toContain('"target_preflight_unmet"')
    await expect(stat(files.attempt)).resolves.toMatchObject({ size: 0 })
  })

  it.each([
    ['both peers', { json: 'exists', markdown: 'exists' }, 'evidence_pair_exists'],
    ['json-only', { json: 'exists', markdown: 'missing' }, 'evidence_pair_partial'],
    ['markdown-only', { json: 'missing', markdown: 'exists' }, 'evidence_pair_partial'],
    ['inspection failure', { json: 'unavailable', markdown: 'missing' }, 'evidence_pair_state_unavailable'],
  ] as const)('fails closed for %s before reservation or downstream calls', async (_label, inspection, outcome) => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'local')
    let reservations = 0
    let downstream = 0
    const storage: DataChainHandoffStorageAdapter = {
      inspectPair: async () => inspection,
      readPair: async () => undefined,
      writePair: async () => 'written',
      reserveAttempt: async () => {
        reservations += 1
        return 'reserved'
      },
    }

    await expect(handoff.runDataChainHandoffCore(request, {
      storage,
      invokeRemotePreflight: async () => {
        downstream += 1
        return 'passed'
      },
      invokeRunner: async () => { downstream += 1 },
      invokeVerifier: async () => {
        downstream += 1
        return pendingVerification(request)
      },
    })).resolves.toMatchObject({ exitCode: 1, outcome, runnerInvocations: 0 })
    expect(reservations).toBe(0)
    expect(downstream).toBe(0)
  })

  it.each([
    ['existing marker', 'exists', 'attempt_already_reserved'],
    ['reservation error', 'unavailable', 'attempt_reservation_unavailable'],
  ] as const)('refuses %s without downstream work', async (_label, reservation, outcome) => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'local')
    let downstream = 0
    const storage: DataChainHandoffStorageAdapter = {
      inspectPair: async () => ({ json: 'missing', markdown: 'missing' }),
      readPair: async () => undefined,
      writePair: async () => 'written',
      reserveAttempt: async () => reservation,
    }

    await expect(handoff.runDataChainHandoffCore(request, {
      storage,
      invokeRemotePreflight: async () => {
        downstream += 1
        return 'passed'
      },
      invokeRunner: async () => { downstream += 1 },
      invokeVerifier: async () => {
        downstream += 1
        return pendingVerification(request)
      },
    })).resolves.toMatchObject({ outcome, runnerInvocations: 0 })
    expect(downstream).toBe(0)
  })

  it('linearizes concurrent local owners at the persistent exclusive marker', async () => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'local')
    const paths = await handoff.deriveDataChainHandoffPaths(request)
    const { storage } = await createTempMappedDataChainHandoffStorage(paths)
    let runners = 0
    const dependencies: DataChainHandoffDependencies = {
      storage,
      invokeRemotePreflight: async () => 'passed',
      invokeRunner: async () => { runners += 1 },
      invokeVerifier: async () => pendingVerification(request),
    }

    const results = await Promise.all([
      handoff.runDataChainHandoffCore(request, dependencies),
      handoff.runDataChainHandoffCore(request, dependencies),
    ])

    expect(results.map(result => result.outcome).sort()).toEqual(['attempt_already_reserved', 'pending'])
    expect(runners).toBe(1)
  })

  it('runs remote preflight once, then immediately enters exactly one runner on green', async () => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'remote')
    const paths = await handoff.deriveDataChainHandoffPaths(request)
    const { storage } = await createTempMappedDataChainHandoffStorage(paths)
    const calls: string[] = []

    await expect(handoff.runDataChainHandoffCore(request, {
      storage,
      invokeRemotePreflight: async () => {
        calls.push('preflight')
        return 'passed'
      },
      invokeRunner: async () => { calls.push('runner') },
      invokeVerifier: async () => {
        calls.push('verifier')
        return pendingVerification(request)
      },
    })).resolves.toMatchObject({ exitCode: 0, preflightStatus: 'passed', runnerInvocations: 1 })
    expect(calls).toEqual(['preflight', 'runner', 'verifier'])
  })

  it('retains the remote marker when checkpoint writing or verification fails', async () => {
    const handoff = await loadHandoff()
    const request = resolvedRequest(handoff, 'remote')
    const paths = await handoff.deriveDataChainHandoffPaths(request)
    const { storage, files } = await createTempMappedDataChainHandoffStorage(paths)
    let verifiers = 0
    const writeFailure: DataChainHandoffStorageAdapter = {
      ...storage,
      writePair: async () => 'unavailable',
    }

    await expect(handoff.runDataChainHandoffCore(request, {
      storage: writeFailure,
      invokeRemotePreflight: async () => 'unmet',
      invokeRunner: async () => { throw new Error('runner must not run') },
      invokeVerifier: async () => {
        verifiers += 1
        return checkpointVerification(request)
      },
    })).resolves.toMatchObject({ outcome: 'handoff_not_ready', preflightStatus: 'unmet' })
    expect(verifiers).toBe(0)
    await expect(stat(files.attempt)).resolves.toMatchObject({ size: 0 })

    const retryPaths = await handoff.deriveDataChainHandoffPaths(request)
    const { storage: verifierFailure, files: verifierFiles } = await createTempMappedDataChainHandoffStorage(retryPaths)
    await expect(handoff.runDataChainHandoffCore(request, {
      storage: verifierFailure,
      invokeRemotePreflight: async () => 'unmet',
      invokeRunner: async () => { throw new Error('runner must not run') },
      invokeVerifier: async () => { throw new Error('verifier unavailable') },
    })).resolves.toMatchObject({ outcome: 'handoff_not_ready', preflightStatus: 'unmet' })
    await expect(stat(verifierFiles.attempt)).resolves.toMatchObject({ size: 0 })
  })
})

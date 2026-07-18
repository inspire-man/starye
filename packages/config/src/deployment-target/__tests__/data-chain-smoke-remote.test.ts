import type { DataChainEvidence } from '../data-chain-evidence'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
} from '../data-chain-evidence'

const evidenceRoot = path.resolve('phase13-remote-evidence')
const baseOptions = {
  mode: 'remote' as const,
  target: 'starye-org',
  runId: 'local-20260716t041000z',
  evidenceRoot,
}

interface SmokeModule {
  parseDataChainSmokeArgs: (argv: readonly string[]) => unknown
  runDataChainSmoke: (options: unknown, dependencies?: unknown) => Promise<{ exitCode: 0 | typeof CHECKPOINT_EXIT_CODE, evidence: DataChainEvidence }>
  executePreparedRemoteCommand: (
    command: string,
    args: readonly string[],
    environment: NodeJS.ProcessEnv,
    root?: string,
  ) => { exitCode: number, stdout: string, stderr: string }
}

interface VerifyModule {
  verifyDataChainSmoke: (options: unknown, dependencies?: unknown) => Promise<0 | typeof CHECKPOINT_EXIT_CODE>
}

async function loadSmoke() {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/data-chain-smoke.ts', import.meta.url).href) as Promise<SmokeModule>
}

async function loadVerify() {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/verify-data-chain-smoke.ts', import.meta.url).href) as Promise<VerifyModule>
}

function evidencePath(runId: string, mode: 'local' | 'remote', extension: 'json' | 'md'): string {
  return path.join(evidenceRoot, baseOptions.target, runId, `${mode}.${extension}`)
}

function localPassedEvidence(runId = baseOptions.runId): DataChainEvidence {
  const itemCode = createDataChainCandidate({ targetId: baseOptions.target, runId }).itemCode
  return {
    version: 1,
    mode: 'local',
    timestamp: '2026-07-16T04:10:00.000Z',
    targetId: baseOptions.target,
    runId,
    itemCode,
    itemId: 'movie-42',
    ingestState: 'resolved',
    aggregate: 'passed',
    observations: [
      { surface: 'local_projection', status: 'passed' },
      { surface: 'local_d1_readiness', status: 'passed' },
      { surface: 'service_readiness', status: 'passed' },
      { surface: 'gateway_auth', status: 'passed', path: '/auth/', origin: 'http://localhost:8080' },
      { surface: 'd1', status: 'passed', itemCount: 1 },
      { surface: 'api', status: 'passed', path: `/api/public/movies/${itemCode}`, origin: 'http://localhost:8080' },
      { surface: 'dashboard', status: 'passed', path: '/dashboard/movies', origin: 'http://localhost:8080' },
      { surface: 'viewer', status: 'passed', path: `/movie/${itemCode}`, origin: 'http://localhost:8080' },
    ],
  }
}

function putPair(files: Map<string, string>, evidence: DataChainEvidence): void {
  files.set(evidencePath(evidence.runId, evidence.mode, 'json'), serializeDataChainEvidenceJson(evidence))
  files.set(evidencePath(evidence.runId, evidence.mode, 'md'), renderDataChainEvidenceMarkdown(evidence))
}

function remoteDependencies(files: Map<string, string>) {
  const candidate = createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId })
  return {
    read: async (file: string) => files.get(file),
    write: async (file: string, contents: string) => {
      files.set(file, contents)
    },
    resolveTarget: () => ({
      id: baseOptions.target,
      profile: {
        ci: { githubEnvironment: 'starye-org' },
        urls: { gateway: 'https://starye.org' },
      },
    }),
    environment: {
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      CRAWLER_SECRET: 'test-crawler-secret',
    } as Record<string, string | undefined>,
    runPreflight: vi.fn((_input: unknown): { ok: boolean, issues: unknown[] } => ({ ok: true, issues: [] })),
    executeReadOnly: vi.fn(() => ({ exitCode: 0, stdout: '' })),
    runPreparedFixture: vi.fn(async () => ({ operation: 'crawler-smoke-fixture' as const, status: 'synced' as const, itemCode: candidate.itemCode, itemCount: 1 as const })),
    runPreparedSnapshot: vi.fn(async () => ({ operation: 'd1-smoke-snapshot' as const, status: 'found' as const, itemCode: candidate.itemCode, itemId: 'remote-movie-42', itemCount: 1 as const })),
    fetchCanonicalApi: vi.fn(async () => ({ status: 200, itemCode: candidate.itemCode, itemId: 'remote-movie-42' })),
  }
}

describe('phase 13 remote smoke runner', () => {
  it('uses the platform-safe pnpm invocation from the crawler workspace for prepared children', async () => {
    const { executePreparedRemoteCommand } = await loadSmoke()
    const crawlerWorkspace = path.resolve(process.cwd(), '../crawler')
    const result = executePreparedRemoteCommand('pnpm', ['exec', 'tsx', '-e', 'process.stdout.write(process.cwd())'], {
      PATH: process.env.PATH,
    }, crawlerWorkspace)

    expect(result.exitCode).toBe(0)
    expect(path.resolve(result.stdout.trim())).toBe(path.resolve(crawlerWorkspace))
  }, 15_000)

  it('requires an explicit remote run id and never selects a latest local run', async () => {
    const { parseDataChainSmokeArgs, runDataChainSmoke } = await loadSmoke()
    expect(() => parseDataChainSmokeArgs(['--mode', 'remote', '--target', baseOptions.target])).toThrow('requires a validated --run-id')

    const files = new Map<string, string>()
    putPair(files, localPassedEvidence('local-20260716t034500z'))
    const dependencies = remoteDependencies(files)
    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ mode: 'remote', ingestState: 'pre_ingest', itemId: null })
    expect(result.evidence.observations).toEqual([{ surface: 'local_projection', status: 'checkpoint', checkpoint: 'local_prerequisite_unmet' }])
    expect(dependencies.runPreflight).not.toHaveBeenCalled()
    expect(dependencies.executeReadOnly).not.toHaveBeenCalled()
    expect(dependencies.runPreparedFixture).not.toHaveBeenCalled()
    expect(dependencies.runPreparedSnapshot).not.toHaveBeenCalled()
  })

  it('stops exact pending or incomplete local records before remote preflight and mutation', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const pending = localPassedEvidence()
    const files = new Map<string, string>()
    putPair(files, { ...pending, ingestState: 'resolved_pending_observation', aggregate: 'pending' } as DataChainEvidence)
    const dependencies = remoteDependencies(files)

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence.observations[0]).toMatchObject({ surface: 'local_projection', checkpoint: 'local_prerequisite_unmet' })
    expect(dependencies.runPreflight).not.toHaveBeenCalled()
    expect(dependencies.runPreparedFixture).not.toHaveBeenCalled()
    expect(dependencies.runPreparedSnapshot).not.toHaveBeenCalled()
  })

  it('rejects an exact local artifact without a passed projection row before provider gates', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const passed = localPassedEvidence()
    const files = new Map<string, string>()
    const incomplete = {
      ...passed,
      ingestState: 'resolved_pending_observation',
      aggregate: 'pending',
      observations: passed.observations.filter(row => row.surface !== 'local_projection'),
    } as DataChainEvidence
    putPair(files, incomplete)
    const dependencies = remoteDependencies(files)

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence.observations[0]).toMatchObject({ surface: 'local_projection', checkpoint: 'local_prerequisite_unmet' })
    expect(dependencies.runPreflight).not.toHaveBeenCalled()
    expect(dependencies.runPreparedFixture).not.toHaveBeenCalled()
    expect(dependencies.runPreparedSnapshot).not.toHaveBeenCalled()
  })

  it('records missing remote credential presence before calling the live preflight', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const files = new Map<string, string>()
    putPair(files, localPassedEvidence())
    const dependencies = remoteDependencies(files)
    dependencies.environment = { CLOUDFLARE_API_TOKEN: 'present', CLOUDFLARE_ACCOUNT_ID: 'present' }

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence.observations).toEqual([{ surface: 'remote_preflight', status: 'checkpoint', checkpoint: 'target_preflight_unmet' }])
    expect(dependencies.runPreflight).not.toHaveBeenCalled()
    expect(dependencies.runPreparedFixture).not.toHaveBeenCalled()
    expect(dependencies.runPreparedSnapshot).not.toHaveBeenCalled()
  })

  it('turns remote preflight failure into redacted pre-ingest evidence before both prepared children', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const files = new Map<string, string>()
    putPair(files, localPassedEvidence())
    const dependencies = remoteDependencies(files)
    dependencies.runPreflight.mockReturnValue({ ok: false, issues: [{ code: 'missing-remote-credentials' }] })

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ mode: 'remote', ingestState: 'pre_ingest', itemId: null })
    expect(result.evidence.observations).toEqual([{ surface: 'remote_preflight', status: 'checkpoint', checkpoint: 'target_preflight_unmet' }])
    expect(dependencies.runPreflight).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'remote',
      command: 'smoke',
      live: true,
      ciEnvironment: 'starye-org',
    }))
    expect(dependencies.runPreparedFixture).not.toHaveBeenCalled()
    expect(dependencies.runPreparedSnapshot).not.toHaveBeenCalled()
  })

  it('preserves the snapshot tuple and uses only the selected canonical API path', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const files = new Map<string, string>()
    putPair(files, localPassedEvidence())
    const dependencies = remoteDependencies(files)
    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({
      mode: 'remote',
      ingestState: 'resolved_pending_observation',
      aggregate: 'pending',
      itemId: 'remote-movie-42',
    })
    expect(dependencies.fetchCanonicalApi).toHaveBeenCalledWith({
      canonicalBase: 'https://starye.org',
      path: `/api/public/movies/${createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode}`,
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemId: 'remote-movie-42',
    })
    expect(result.evidence.observations.map(row => row.surface)).toEqual(['remote_preflight', 'd1', 'api'])
  })

  it('keeps the authoritative item id when the canonical API cannot correlate it', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const files = new Map<string, string>()
    putPair(files, localPassedEvidence())
    const dependencies = remoteDependencies(files)
    dependencies.fetchCanonicalApi.mockResolvedValue({ status: 200, itemCode: 'wrong-code', itemId: 'remote-movie-42' })

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ ingestState: 'resolved_pending_observation', aggregate: 'checkpoint', itemId: 'remote-movie-42' })
    expect(result.evidence.observations).toContainEqual(expect.objectContaining({ surface: 'api', status: 'checkpoint', checkpoint: 'canonical_api_unavailable' }))
    expect(result.evidence.observations).not.toContainEqual(expect.objectContaining({ surface: 'dashboard', status: 'passed' }))
    expect(result.evidence.observations).not.toContainEqual(expect.objectContaining({ surface: 'viewer', status: 'passed' }))
  })

  it('records a prepared fixture failure without starting the D1 snapshot', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const files = new Map<string, string>()
    putPair(files, localPassedEvidence())
    const dependencies = remoteDependencies(files)
    dependencies.runPreparedFixture.mockRejectedValue(new Error('prepared fixture failed'))

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ ingestState: 'pre_ingest', itemId: null })
    expect(dependencies.runPreparedFixture).toHaveBeenCalledTimes(1)
    expect(dependencies.runPreparedSnapshot).not.toHaveBeenCalled()
  })

  it('rejects a prepared batch count mismatch before D1 snapshot and API proof', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const files = new Map<string, string>()
    putPair(files, localPassedEvidence())
    const dependencies = remoteDependencies(files)
    dependencies.runPreparedFixture.mockResolvedValue({
      operation: 'crawler-smoke-fixture' as const,
      status: 'synced' as const,
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemCount: 9 as never,
    })

    const result = await runDataChainSmoke(baseOptions, dependencies)
    expect(result.evidence).toMatchObject({ ingestState: 'pre_ingest', itemId: null })
    expect(dependencies.runPreparedSnapshot).not.toHaveBeenCalled()
    expect(dependencies.fetchCanonicalApi).not.toHaveBeenCalled()
  })

  it('preserves a schema-valid remote checkpoint through the shared wrapper', async () => {
    const { verifyDataChainSmoke } = await loadVerify()
    const files = new Map<string, string>()
    const checkpoint = {
      version: 1,
      mode: 'remote',
      timestamp: '2026-07-16T04:10:00.000Z',
      targetId: baseOptions.target,
      runId: baseOptions.runId,
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemId: null,
      ingestState: 'pre_ingest',
      aggregate: 'checkpoint',
      observations: [{ surface: 'local_projection', status: 'checkpoint', checkpoint: 'local_prerequisite_unmet' }],
    } as DataChainEvidence
    putPair(files, checkpoint)

    await expect(verifyDataChainSmoke(baseOptions, {
      run: async () => CHECKPOINT_EXIT_CODE,
      read: async (file: string) => files.get(file),
    })).resolves.toBe(CHECKPOINT_EXIT_CODE)
  })
})

import type { DataChainEvidence, DataChainMode, DataChainSurface } from '../data-chain-evidence'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appendBrowserObservation,
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  createDataChainExecutionReceipt,
  createPreIngestEvidence,
  createResolvedPendingEvidence,
  LOCAL_GATEWAY_ORIGIN,
  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
} from '../data-chain-evidence'

interface VerificationResult {
  exitCode: 0 | typeof CHECKPOINT_EXIT_CODE
  outcome: 'terminal_passed' | 'checkpoint'
  provesExternalChain: boolean
  evidence: DataChainEvidence
}

interface VerifyModule {
  inspectDataChainSmokeVerification: (options: unknown, dependencies?: unknown) => Promise<VerificationResult>
  runVerifyDataChainSmokeCli: (argv: readonly string[], dependencies?: unknown) => Promise<0 | typeof CHECKPOINT_EXIT_CODE>
  verifyDataChainSmoke: (options: unknown, dependencies?: unknown) => Promise<0 | typeof CHECKPOINT_EXIT_CODE>
}

const targetId = 'starye-org'
const runId = 'local-20260718t000000z'
const roots: string[] = []

async function loadVerify() {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/verify-data-chain-smoke.ts', import.meta.url).href) as Promise<VerifyModule>
}

function receiptFor(mode: DataChainMode, itemCode: string, itemId: string, surface: DataChainSurface) {
  const capture = {
    local_projection: 'local_projection',
    local_d1_readiness: 'local_d1_readiness',
    service_readiness: 'service_probe',
    gateway_auth: 'gateway_auth',
    remote_preflight: 'remote_preflight',
    d1: mode === 'local' ? 'local_fixture_snapshot' : 'remote_fixture_snapshot',
    api: 'canonical_api',
    dashboard: 'browser_navigation',
    viewer: 'browser_navigation',
  } as const
  const routePath = surface === 'gateway_auth'
    ? '/auth/'
    : surface === 'api'
      ? `/api/public/movies/${itemCode}`
      : surface === 'dashboard' ? '/dashboard/movies' : surface === 'viewer' ? `/movie/${itemCode}` : undefined
  return createDataChainExecutionReceipt({
    source: surface === 'dashboard' || surface === 'viewer'
      ? 'browser_observer'
      : mode === 'local' ? 'local_runner' : 'remote_provider',
    capture: capture[surface],
    mode,
    targetId,
    runId,
    itemCode,
    itemId,
    surface,
    ...(routePath ? { path: routePath } : {}),
    timestamp: '2026-07-18T00:00:00.000Z',
  })
}

function terminalEvidence(mode: DataChainMode): DataChainEvidence {
  const itemCode = createDataChainCandidate({ targetId, runId }).itemCode
  const itemId = mode === 'local' ? 'local-movie-42' : 'remote-movie-42'
  const observations = mode === 'local'
    ? [
        { surface: 'local_projection', status: 'passed', receipt: receiptFor(mode, itemCode, itemId, 'local_projection') },
        { surface: 'local_d1_readiness', status: 'passed', receipt: receiptFor(mode, itemCode, itemId, 'local_d1_readiness') },
        { surface: 'service_readiness', status: 'passed', receipt: receiptFor(mode, itemCode, itemId, 'service_readiness') },
        { surface: 'gateway_auth', status: 'passed', path: '/auth/', origin: LOCAL_GATEWAY_ORIGIN, receipt: receiptFor(mode, itemCode, itemId, 'gateway_auth') },
        { surface: 'd1', status: 'passed', itemCount: 1, receipt: receiptFor(mode, itemCode, itemId, 'd1') },
        { surface: 'api', status: 'passed', path: `/api/public/movies/${itemCode}`, origin: LOCAL_GATEWAY_ORIGIN, receipt: receiptFor(mode, itemCode, itemId, 'api') },
      ] as const
    : [
        { surface: 'remote_preflight', status: 'passed', receipt: receiptFor(mode, itemCode, itemId, 'remote_preflight') },
        { surface: 'd1', status: 'passed', itemCount: 1, receipt: receiptFor(mode, itemCode, itemId, 'd1') },
        { surface: 'api', status: 'passed', path: `/api/public/movies/${itemCode}`, receipt: receiptFor(mode, itemCode, itemId, 'api') },
      ] as const
  const pending = createResolvedPendingEvidence({
    targetId,
    runId,
    itemCode,
    itemId,
    mode,
    timestamp: '2026-07-18T00:00:00.000Z',
    observations,
  })
  const dashboard = appendBrowserObservation(pending, {
    targetId,
    runId,
    itemCode,
    itemId,
    surface: 'dashboard',
    status: 'passed',
    receipt: receiptFor(mode, itemCode, itemId, 'dashboard'),
  })
  return appendBrowserObservation(dashboard.evidence, {
    targetId,
    runId,
    itemCode,
    itemId,
    surface: 'viewer',
    status: 'passed',
    receipt: receiptFor(mode, itemCode, itemId, 'viewer'),
  }).evidence
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-13-07-'))
  roots.push(root)
  return root
}

function evidencePaths(root: string, mode: DataChainMode) {
  const directory = path.join(root, targetId, runId)
  return {
    directory,
    json: path.join(directory, `${mode}.json`),
    markdown: path.join(directory, `${mode}.md`),
  }
}

async function writePair(root: string, evidence: DataChainEvidence): Promise<void> {
  const files = evidencePaths(root, evidence.mode)
  await mkdir(files.directory, { recursive: true })
  await writeFile(files.json, serializeDataChainEvidenceJson(evidence), 'utf8')
  await writeFile(files.markdown, renderDataChainEvidenceMarkdown(evidence), 'utf8')
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('phase 13 provenance-aware verifier', () => {
  it.each(['local', 'remote'] as const)('accepts a complete receipt-backed %s terminal pair', async (mode) => {
    const { verifyDataChainSmoke } = await loadVerify()
    const root = await temporaryRoot()
    const evidence = terminalEvidence(mode)
    await writePair(root, evidence)

    await expect(verifyDataChainSmoke({ mode, target: targetId, runId, evidenceRoot: root }, {
      run: async () => 0,
    })).resolves.toBe(0)
  })

  it('rejects a legacy self-attested terminal pair even when its tuple and shape otherwise agree', async () => {
    const { verifyDataChainSmoke } = await loadVerify()
    const root = await temporaryRoot()
    const evidence = terminalEvidence('local')
    const legacy = {
      ...evidence,
      observations: evidence.observations.map((row) => {
        const copy: Record<string, unknown> = { ...row }
        delete copy.receipt
        return copy
      }),
    }
    const files = evidencePaths(root, 'local')
    await mkdir(files.directory, { recursive: true })
    await writeFile(files.json, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8')
    await writeFile(files.markdown, renderDataChainEvidenceMarkdown(evidence), 'utf8')

    await expect(verifyDataChainSmoke({ mode: 'local', target: targetId, runId, evidenceRoot: root }, {
      run: async () => 0,
    })).rejects.toThrow('provenance receipt')
  })

  it('classifies a valid checkpoint pair as non-success proof', async () => {
    const { inspectDataChainSmokeVerification, verifyDataChainSmoke } = await loadVerify()
    const root = await temporaryRoot()
    const itemCode = createDataChainCandidate({ targetId, runId }).itemCode
    const checkpoint = createPreIngestEvidence({
      targetId,
      runId,
      candidateItemCode: itemCode,
      mode: 'remote',
      timestamp: '2026-07-18T00:00:00.000Z',
      observation: {
        surface: 'remote_preflight',
        status: 'checkpoint',
        checkpoint: 'target_preflight_unmet',
      },
    })
    await writePair(root, checkpoint)
    const options = { mode: 'remote' as const, target: targetId, runId, evidenceRoot: root }
    const dependencies = { run: async () => CHECKPOINT_EXIT_CODE }

    await expect(verifyDataChainSmoke(options, dependencies)).resolves.toBe(CHECKPOINT_EXIT_CODE)
    await expect(inspectDataChainSmokeVerification(options, dependencies)).resolves.toMatchObject({
      exitCode: CHECKPOINT_EXIT_CODE,
      outcome: 'checkpoint',
      provesExternalChain: false,
      evidence: {
        ingestState: 'pre_ingest',
        aggregate: 'checkpoint',
      },
    })
    expect(renderDataChainEvidenceMarkdown(checkpoint)).toContain('- Aggregate: checkpoint')
  })

  it('rejects runner exit codes that disagree with the exact persisted pair', async () => {
    const { verifyDataChainSmoke } = await loadVerify()
    const root = await temporaryRoot()
    await writePair(root, terminalEvidence('remote'))
    const options = { mode: 'remote' as const, target: targetId, runId, evidenceRoot: root }

    await expect(verifyDataChainSmoke(options, {
      run: async () => CHECKPOINT_EXIT_CODE,
    })).rejects.toThrow('does not match persisted evidence')
    await expect(verifyDataChainSmoke(options, {
      run: async () => 1,
    })).rejects.toThrow('unexpected exit code')
  })

  it('emits an allowlisted machine result that does not promote checkpoint evidence', async () => {
    const { runVerifyDataChainSmokeCli } = await loadVerify()
    const itemCode = createDataChainCandidate({ targetId, runId }).itemCode
    const checkpoint = createPreIngestEvidence({
      targetId,
      runId,
      candidateItemCode: itemCode,
      mode: 'remote',
      timestamp: '2026-07-18T00:00:00.000Z',
      observation: {
        surface: 'remote_preflight',
        status: 'checkpoint',
        checkpoint: 'target_preflight_unmet',
      },
    })
    const json = serializeDataChainEvidenceJson(checkpoint)
    const markdown = renderDataChainEvidenceMarkdown(checkpoint)
    const messages: string[] = []

    await expect(runVerifyDataChainSmokeCli([
      '--mode',
      'remote',
      '--target',
      targetId,
      '--run-id',
      runId,
    ], {
      run: async () => CHECKPOINT_EXIT_CODE,
      read: async (file: string) => file.endsWith('.json') ? json : markdown,
      log: (message: string) => messages.push(message),
    })).resolves.toBe(CHECKPOINT_EXIT_CODE)
    expect(messages).toHaveLength(1)
    expect(JSON.parse(messages[0] ?? '{}')).toEqual({
      mode: 'remote',
      target: targetId,
      runId,
      state: 'pre_ingest',
      aggregate: 'checkpoint',
      outcome: 'checkpoint',
      provesExternalChain: false,
    })
  })
})

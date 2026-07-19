import type { DataChainEvidence } from '../../data-chain-evidence.ts'
import process from 'node:process'
import {
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
  validateDataChainEvidence,
} from '../../data-chain-evidence.ts'

const targetId = 'starye-org'
const runId = 'process-auth-timeout-fixture'
const candidate = createDataChainCandidate({ targetId, runId })

interface SmokeModule {
  runDataChainSmoke: (options: unknown, dependencies?: unknown) => Promise<{
    exitCode: 0 | typeof CHECKPOINT_EXIT_CODE
    evidence: DataChainEvidence
  }>
}

async function loadSmoke(): Promise<SmokeModule> {
  return import(/* @vite-ignore */ new URL('../../../../../../scripts/data-chain-smoke.ts', import.meta.url).href) as Promise<SmokeModule>
}

function assertTestCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function main(): Promise<void> {
  const { runDataChainSmoke } = await loadSmoke()
  const peers = new Map<string, string>()
  let peerWrites = 0
  let gatewayAuthFetchCalls = 0
  let fixtureCalls = 0
  let snapshotCalls = 0
  let gatewayApiCalls = 0
  const browserObserverCalls = 0
  let providerRemoteCalls = 0

  const gatewayAuthFetch: typeof fetch = (_input, init) => {
    gatewayAuthFetchCalls += 1
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      assertTestCondition(signal, 'Gateway auth probe must provide an AbortSignal.')
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  }

  const result = await runDataChainSmoke({
    mode: 'local',
    target: targetId,
    runId,
    evidenceRoot: 'process-test-memory-only',
  }, {
    resolveTarget: () => ({
      id: targetId,
      profile: { local: { wranglerProfile: 'starye-org' } },
    }),
    collectProjectionIssues: async () => [],
    runPreflight: () => ({ ok: true, issues: [] }),
    inspectLocalD1: async () => ({ status: 'ready' }),
    checkServices: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    gatewayAuthFetch,
    gatewayAuthTimeoutMs: 50,
    runFixture: async () => {
      fixtureCalls += 1
      return { itemCode: candidate.itemCode, itemCount: 1 as const }
    },
    snapshot: async () => {
      snapshotCalls += 1
      return { status: 'found' as const, itemCode: candidate.itemCode, itemId: 'unexpected-item', itemCount: 1 as const }
    },
    fetchGatewayApi: async () => {
      gatewayApiCalls += 1
      return { status: 200, itemCode: candidate.itemCode, itemId: 'unexpected-item' }
    },
    runPreparedFixture: async () => {
      providerRemoteCalls += 1
      return { operation: 'crawler-smoke-fixture', itemCode: candidate.itemCode, itemCount: 1 as const }
    },
    runPreparedSnapshot: async () => {
      providerRemoteCalls += 1
      return { operation: 'd1-smoke-snapshot', status: 'found' as const, itemCode: candidate.itemCode, itemId: 'unexpected-item', itemCount: 1 as const }
    },
    now: () => '2026-07-19T00:00:00.000Z',
    write: async (file: string, contents: string) => {
      peerWrites += 1
      peers.set(file, contents)
    },
  })

  const json = [...peers.entries()].find(([file]) => file.endsWith('.json'))?.[1]
  const markdown = [...peers.entries()].find(([file]) => file.endsWith('.md'))?.[1]
  const observation = result.evidence.observations[0]
  assertTestCondition(result.exitCode === CHECKPOINT_EXIT_CODE, 'Timeout checkpoint must return raw exit code 2.')
  assertTestCondition(peerWrites === 2 && json && markdown, 'Timeout checkpoint must persist exactly two in-memory peers.')
  assertTestCondition(validateDataChainEvidence(JSON.parse(json)).length === 0, 'JSON peer must validate before process completion.')
  assertTestCondition(json === serializeDataChainEvidenceJson(result.evidence), 'JSON peer must match the returned evidence.')
  assertTestCondition(markdown === renderDataChainEvidenceMarkdown(result.evidence), 'Markdown peer must match the returned evidence.')
  assertTestCondition(
    result.evidence.ingestState === 'pre_ingest'
    && result.evidence.itemId === null
    && observation?.surface === 'gateway_auth'
    && observation.status === 'checkpoint'
    && observation.checkpoint === 'gateway_auth_timeout',
    'Timeout result must be the one closed pre-ingest Gateway auth checkpoint.',
  )
  assertTestCondition(
    fixtureCalls === 0
    && snapshotCalls === 0
    && gatewayApiCalls === 0
    && browserObserverCalls === 0
    && providerRemoteCalls === 0,
    'Timeout checkpoint must not invoke downstream dependencies.',
  )

  process.stdout.write(`${JSON.stringify({
    schema: 'phase13-data-chain-auth-timeout-test-1',
    exitCode: result.exitCode,
    checkpoint: observation.checkpoint,
    peerWrites,
    gatewayAuthFetchCalls,
    downstreamCalls: {
      fixture: fixtureCalls,
      snapshot: snapshotCalls,
      gatewayApi: gatewayApiCalls,
      browserObserver: browserObserverCalls,
      providerRemote: providerRemoteCalls,
    },
  })}\n`)
}

void main().then(() => {
  process.exitCode = CHECKPOINT_EXIT_CODE
}).catch(() => {
  process.exitCode = 1
})

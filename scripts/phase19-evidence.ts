import type {
  Phase19Evidence,
  Phase19EvidenceInput,
} from '../packages/config/src/deployment-target/data-chain-evidence.ts'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  buildPhase19Evidence,
  LOCAL_GATEWAY_ORIGIN,
  renderPhase19EvidenceMarkdown,
  serializePhase19EvidenceJson,
  validatePhase19Evidence,
} from '../packages/config/src/deployment-target/data-chain-evidence.ts'

export interface Phase19EvidencePair {
  readonly evidence: Phase19Evidence
  readonly json: string
  readonly markdown: string
}

const sensitiveKeyPattern = /authorization|cookie|header|secret|token|private[_-]?key|raw[_-]?(?:response|payload|body)|argv/i
const sensitiveValuePattern = /bearer\s+|-----BEGIN|gh[pousr]_[A-Z0-9]|token=|password=|secret=/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function scanSensitive(value: unknown, path = 'evidence'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => scanSensitive(entry, `${path}[${index}]`))
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && sensitiveValuePattern.test(value))
      return [path]
    return []
  }

  const issues: string[] = []
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    if (sensitiveKeyPattern.test(key))
      issues.push(childPath)
    issues.push(...scanSensitive(child, childPath))
  }
  return issues
}

function assertSafeEvidence(value: unknown): void {
  const issues = scanSensitive(value)
  if (issues.length > 0)
    throw new Error(`Sensitive evidence fields are not durable: ${issues.join(', ')}`)
}

function assertPairStable(pair: Phase19EvidencePair): void {
  const secondJson = serializePhase19EvidenceJson(pair.evidence)
  const secondMarkdown = renderPhase19EvidenceMarkdown(pair.evidence)
  if (pair.json !== secondJson || pair.markdown !== secondMarkdown) {
    throw new Error('Phase 19 evidence pair is not deterministic.')
  }
}

/** Validates once and renders both projections from the same typed evidence object. */
export function buildPhase19EvidencePair(input: Phase19EvidenceInput): Phase19EvidencePair {
  const evidence = buildPhase19Evidence(input)
  const schemaIssues = validatePhase19Evidence(evidence)
  if (schemaIssues.length > 0)
    throw new Error(`Invalid Phase 19 evidence: ${schemaIssues.join(' ')}`)
  assertSafeEvidence(evidence)

  const pair = {
    evidence,
    json: serializePhase19EvidenceJson(evidence),
    markdown: renderPhase19EvidenceMarkdown(evidence),
  }
  assertPairStable(pair)
  assertSafeEvidence(JSON.parse(pair.json) as Phase19Evidence)
  assertSafeEvidence(pair.markdown)
  return pair
}

/** Writes only validated JSON/Markdown projections; the source input is never rewritten. */
export async function writePhase19EvidencePair(input: Phase19EvidenceInput, outputDir: string): Promise<{ jsonPath: string, markdownPath: string }> {
  const pair = buildPhase19EvidencePair(input)
  const stem = `phase19-${pair.evidence.mode}-${pair.evidence.template}-${pair.evidence.taskId}-${pair.evidence.runId}`
    .replace(/[^\w.-]+/g, '-')
  await mkdir(outputDir, { recursive: true })
  const jsonPath = join(outputDir, `${stem}.json`)
  const markdownPath = join(outputDir, `${stem}.md`)
  await writeFile(jsonPath, pair.json, 'utf8')
  await writeFile(markdownPath, pair.markdown, 'utf8')
  return { jsonPath, markdownPath }
}

async function readInput(path: string): Promise<Phase19EvidenceInput> {
  const raw = await readFile(path, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed))
    throw new Error('Phase 19 input JSON must be an object.')
  return parsed as Phase19EvidenceInput
}

const selfTestLocalInput: Phase19EvidenceInput = {
  mode: 'local_contract',
  status: 'passed',
  target: 'local-gateway',
  template: 'movie',
  workflow: 'local-contract',
  repository: 'local-contract',
  ref: 'fixture',
  environment: 'local',
  taskId: 'task-local-movie-01',
  runId: 'run-local-movie-01',
  attempt: 1,
  callbackEventIds: [],
  callbackNonces: [],
  validatedReceipt: {
    template: 'movie',
    primaryContentId: 'movie-local-01',
    createdCount: 1,
    updatedCount: 1,
  },
  gatewayUrl: LOCAL_GATEWAY_ORIGIN,
  crud: { mutation: 'passed', readback: 'passed', restore: 'passed' },
  command: 'phase19-local-proof',
  timestamp: '2026-08-01T00:00:00.000Z',
}

const selfTestProviderInput: Phase19EvidenceInput = {
  mode: 'credentialed_provider',
  status: 'passed',
  target: 'starye-org',
  template: 'movie',
  workflow: '.github/workflows/daily-movie-crawl.yml',
  repository: 'inspire-man/starye',
  ref: 'main',
  environment: 'starye-org',
  taskId: 'task-provider-movie-01',
  runId: 'run-provider-movie-01',
  attempt: 1,
  provider: {
    runId: '12345',
    attempt: 1,
    sha: 'a'.repeat(40),
    url: 'https://github.com/inspire-man/starye/actions/runs/12345',
  },
  callbackEventIds: ['evt-provider-success'],
  callbackNonces: ['nonce-provider-success'],
  validatedReceipt: {
    source: 'remote_provider',
    template: 'movie',
    primaryContentId: 'movie-provider-01',
    createdCount: 1,
    updatedCount: 1,
  },
  gatewayUrl: 'https://starye.example.test',
  crud: { mutation: 'passed', readback: 'passed', restore: 'passed' },
  command: 'phase19-provider-signoff',
  timestamp: '2026-08-01T00:00:00.000Z',
}

function runSelfTest(): void {
  const local = buildPhase19EvidencePair(selfTestLocalInput)
  const provider = buildPhase19EvidencePair(selfTestProviderInput)
  if (local.evidence.mode === provider.evidence.mode)
    throw new Error('Phase 19 local/provider labels are not separated.')
  if (!local.json.includes('local_contract') || !provider.json.includes('credentialed_provider'))
    throw new Error('Phase 19 mode labels are missing.')
  if (local.json.includes('providerRun') || local.markdown.includes('github.com'))
    throw new Error('Local evidence contains provider facts.')
  process.stdout.write(`${JSON.stringify({
    selfTest: 'passed',
    local: { jsonBytes: local.json.length, markdownBytes: local.markdown.length },
    provider: { jsonBytes: provider.json.length, markdownBytes: provider.markdown.length },
  })}\n`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    runSelfTest()
    return
  }

  const validateIndex = args.indexOf('--validate')
  if (validateIndex >= 0) {
    const inputPath = args[validateIndex + 1]
    if (!inputPath)
      throw new Error('Usage: tsx scripts/phase19-evidence.ts --validate evidence.json')
    const input = await readInput(inputPath)
    const evidence = buildPhase19Evidence(input)
    process.stdout.write(`${JSON.stringify({ valid: true, mode: evidence.mode, template: evidence.template, status: evidence.status })}\n`)
    return
  }

  const inputIndex = args.indexOf('--input')
  const outputIndex = args.indexOf('--output-dir')
  if (inputIndex < 0 || outputIndex < 0 || !args[inputIndex + 1] || !args[outputIndex + 1]) {
    throw new Error('Usage: tsx scripts/phase19-evidence.ts --self-test | --input evidence.json --output-dir DIR')
  }
  const inputPath = args[inputIndex + 1]
  const outputDir = args[outputIndex + 1]
  const input = await readInput(inputPath)
  const output = await writePhase19EvidencePair(input, outputDir)
  process.stdout.write(`${JSON.stringify({ input: basename(inputPath), output })}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
}

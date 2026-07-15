import type { CHECKPOINT_EXIT_CODE, DataChainCheckpoint, DataChainEvidence, DataChainMode, DataChainObservationStatus, ResolvedPendingDataChainEvidence } from '../packages/config/src/deployment-target/index'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  appendBrowserObservation,
  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
  validateDataChainEvidenceForExitCode,
} from '../packages/config/src/deployment-target/index'
import { DATA_CHAIN_EVIDENCE_ROOT, getDataChainEvidencePaths } from './data-chain-smoke'

export interface DataChainSurfaceAppendOptions {
  readonly mode: DataChainMode
  readonly target: string
  readonly runId: string
  readonly itemCode: string
  readonly itemId: string
  readonly surface: 'dashboard' | 'viewer'
  readonly path: string
  readonly status: DataChainObservationStatus
  readonly checkpoint?: DataChainCheckpoint
}

export interface DataChainSurfaceValidateOptions {
  readonly target: string
  readonly runId: string
  readonly itemCode: string
  readonly itemId: string
}

export type DataChainSurfaceObservationArgs
  = | { readonly kind: 'append', readonly options: DataChainSurfaceAppendOptions }
    | { readonly kind: 'validate', readonly options: DataChainSurfaceValidateOptions }

export interface DataChainSurfaceObservationDependencies {
  readonly evidenceRoot?: string
  readonly read?: (file: string) => Promise<string | undefined>
  readonly write?: (file: string, contents: string) => Promise<void>
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function optionMap(argv: readonly string[]): Record<string, string | true> {
  const values: Record<string, string | true> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (!flag?.startsWith('--')) {
      throw new Error(`Unknown data-chain observation argument: ${flag}.`)
    }
    if (flag === '--validate') {
      if (values[flag] !== undefined)
        throw new Error('Duplicate --validate.')
      values[flag] = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}.`)
    }
    if (values[flag] !== undefined)
      throw new Error(`Duplicate data-chain observation argument: ${flag}.`)
    values[flag] = value
    index += 1
  }
  return values
}

function requireText(values: Record<string, string | true>, flag: string): string {
  const value = values[flag]
  if (!text(value))
    throw new Error(`Missing ${flag}.`)
  return value
}

export function parseDataChainSurfaceObservationArgs(argv: readonly string[]): DataChainSurfaceObservationArgs {
  const values = optionMap(argv)
  const validate = values['--validate'] === true
  const validateKeys = ['--validate', '--target', '--run-id', '--item-code', '--item-id']
  if (validate) {
    const unexpected = Object.keys(values).find(key => !validateKeys.includes(key))
    if (unexpected)
      throw new Error(`--validate does not accept ${unexpected}.`)
    return { kind: 'validate', options: {
      target: requireText(values, '--target'),
      runId: requireText(values, '--run-id'),
      itemCode: requireText(values, '--item-code'),
      itemId: requireText(values, '--item-id'),
    } }
  }
  const appendKeys = ['--mode', '--target', '--run-id', '--item-code', '--item-id', '--surface', '--path', '--status', '--checkpoint']
  const unexpected = Object.keys(values).find(key => !appendKeys.includes(key))
  if (unexpected)
    throw new Error(`Unsupported data-chain observation argument: ${unexpected}.`)
  const mode = requireText(values, '--mode')
  if (mode !== 'local' && mode !== 'remote')
    throw new Error('Append mode must be local or remote.')
  const surface = requireText(values, '--surface')
  if (surface !== 'dashboard' && surface !== 'viewer')
    throw new Error('Append surface must be dashboard or viewer.')
  if (surface === 'viewer' && !Object.hasOwn(values, '--surface'))
    throw new Error('Viewer observation requires Dashboard first.')
  const itemCode = requireText(values, '--item-code')
  const routePath = requireText(values, '--path')
  const expectedPath = surface === 'dashboard' ? '/dashboard/movies' : `/movie/${itemCode}`
  if (routePath !== expectedPath)
    throw new Error('Append path must be the canonical Gateway path.')
  const status = requireText(values, '--status')
  if (status !== 'passed' && status !== 'failed' && status !== 'checkpoint')
    throw new Error('Append status is invalid.')
  const checkpoint = values['--checkpoint']
  if (status === 'checkpoint' && !text(checkpoint))
    throw new Error('Checkpoint status requires --checkpoint.')
  if (status !== 'checkpoint' && checkpoint !== undefined)
    throw new Error('--checkpoint is only allowed with checkpoint status.')
  return { kind: 'append', options: {
    mode,
    target: requireText(values, '--target'),
    runId: requireText(values, '--run-id'),
    itemCode,
    itemId: requireText(values, '--item-id'),
    surface,
    path: routePath,
    status,
    ...(text(checkpoint) ? { checkpoint: checkpoint as DataChainCheckpoint } : {}),
  } }
}

async function readDefault(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined
    throw error
  }
}

async function loadEvidence(file: string, read: (file: string) => Promise<string | undefined>): Promise<DataChainEvidence> {
  const contents = await read(file)
  if (!contents)
    throw new Error('Data-chain evidence artifact is missing.')
  let evidence: unknown
  try {
    evidence = JSON.parse(contents)
  }
  catch {
    throw new Error('Data-chain evidence JSON is malformed.')
  }
  validateDataChainEvidenceForExitCode(evidence)
  return evidence as DataChainEvidence
}

async function writePair(mode: DataChainMode, target: string, runId: string, evidence: DataChainEvidence, dependencies: DataChainSurfaceObservationDependencies): Promise<void> {
  const root = dependencies.evidenceRoot ?? DATA_CHAIN_EVIDENCE_ROOT
  const paths = getDataChainEvidencePaths({ mode, target, runId, evidenceRoot: root })
  const write = dependencies.write ?? ((file, contents) => writeFile(file, contents, 'utf8'))
  await write(paths.json, serializeDataChainEvidenceJson(evidence))
  await write(paths.markdown, renderDataChainEvidenceMarkdown(evidence))
}

export async function appendDataChainSurfaceObservation(options: DataChainSurfaceAppendOptions, dependencies: DataChainSurfaceObservationDependencies = {}): Promise<{ exitCode: 0 | typeof CHECKPOINT_EXIT_CODE, evidence: DataChainEvidence }> {
  const root = dependencies.evidenceRoot ?? DATA_CHAIN_EVIDENCE_ROOT
  const paths = getDataChainEvidencePaths({ mode: options.mode, target: options.target, runId: options.runId, evidenceRoot: root })
  const existing = await loadEvidence(paths.json, dependencies.read ?? readDefault)
  if (existing.ingestState !== 'resolved_pending_observation')
    throw new Error('Browser observation requires resolved_pending_observation evidence.')
  const input = {
    targetId: options.target,
    runId: options.runId,
    itemCode: options.itemCode,
    itemId: options.itemId,
    status: options.status,
    ...(options.checkpoint ? { checkpoint: options.checkpoint } : {}),
  }
  const result = options.surface === 'dashboard'
    ? appendBrowserObservation(existing as ResolvedPendingDataChainEvidence, { ...input, surface: 'dashboard' })
    : appendBrowserObservation(existing as ResolvedPendingDataChainEvidence, { ...input, surface: 'viewer' })
  await writePair(options.mode, options.target, options.runId, result.evidence, { ...dependencies, evidenceRoot: root })
  return result
}

export async function validateDataChainSurfaceObservation(options: DataChainSurfaceValidateOptions, dependencies: DataChainSurfaceObservationDependencies = {}): Promise<0> {
  const root = dependencies.evidenceRoot ?? DATA_CHAIN_EVIDENCE_ROOT
  const read = dependencies.read ?? readDefault
  const matches: DataChainEvidence[] = []
  for (const mode of ['local', 'remote'] as const) {
    const paths = getDataChainEvidencePaths({ mode, target: options.target, runId: options.runId, evidenceRoot: root })
    const contents = await read(paths.json)
    if (!contents)
      continue
    const evidence = await loadEvidence(paths.json, read)
    if (evidence.targetId === options.target && evidence.runId === options.runId && evidence.itemCode === options.itemCode && evidence.itemId === options.itemId) {
      const markdown = await read(paths.markdown)
      if (markdown !== renderDataChainEvidenceMarkdown(evidence))
        throw new Error('Data-chain evidence Markdown does not match JSON.')
      matches.push(evidence)
    }
  }
  if (matches.length !== 1)
    throw new Error('Validation requires exactly one matching local or remote evidence tuple.')
  return 0
}

export async function runDataChainSurfaceObservationCli(argv: readonly string[] = process.argv.slice(2)): Promise<0 | typeof CHECKPOINT_EXIT_CODE> {
  const parsed = parseDataChainSurfaceObservationArgs(argv)
  if (parsed.kind === 'validate')
    return validateDataChainSurfaceObservation(parsed.options)
  const result = await appendDataChainSurfaceObservation(parsed.options)
  return result.exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runDataChainSurfaceObservationCli().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

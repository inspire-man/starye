import type { DataChainEvidence } from '../packages/config/src/deployment-target/index'
import type { DataChainSmokeOptions } from './data-chain-smoke'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  CHECKPOINT_EXIT_CODE,
  renderDataChainEvidenceMarkdown,
  validateDataChainEvidenceForExitCode,
} from '../packages/config/src/deployment-target/index'
import {
  DATA_CHAIN_EVIDENCE_ROOT,

  getDataChainEvidencePaths,
  parseDataChainSmokeArgs,
  runDataChainSmoke,
} from './data-chain-smoke'

export interface VerifyDataChainSmokeDependencies {
  readonly run?: (options: DataChainSmokeOptions) => Promise<number>
  readonly read?: (file: string) => Promise<string | undefined>
}

function validPendingOrCheckpoint(evidence: DataChainEvidence): boolean {
  return (evidence.ingestState === 'pre_ingest' && (evidence.aggregate === 'failed' || evidence.aggregate === 'checkpoint'))
    || (evidence.ingestState === 'resolved_pending_observation' && evidence.aggregate !== 'pending' ? evidence.aggregate === 'failed' || evidence.aggregate === 'checkpoint' : evidence.ingestState === 'resolved_pending_observation')
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

async function loadPair(options: DataChainSmokeOptions, read: (file: string) => Promise<string | undefined>): Promise<DataChainEvidence> {
  const paths = getDataChainEvidencePaths(options)
  const json = await read(paths.json)
  const markdown = await read(paths.markdown)
  if (!json || !markdown)
    throw new Error('Data-chain evidence pair is missing.')
  let evidence: unknown
  try {
    evidence = JSON.parse(json)
  }
  catch {
    throw new Error('Data-chain evidence JSON is malformed.')
  }
  validateDataChainEvidenceForExitCode(evidence)
  if (markdown !== renderDataChainEvidenceMarkdown(evidence))
    throw new Error('Data-chain evidence Markdown does not match JSON.')
  const typed = evidence as DataChainEvidence
  if (typed.mode !== options.mode || typed.targetId !== options.target || typed.runId !== options.runId)
    throw new Error('Data-chain evidence tuple does not match runner arguments.')
  return typed
}

export async function verifyDataChainSmoke(options: DataChainSmokeOptions, dependencies: VerifyDataChainSmokeDependencies = {}): Promise<0 | typeof CHECKPOINT_EXIT_CODE> {
  const run = dependencies.run ?? (async input => (await runDataChainSmoke(input)).exitCode)
  const exitCode = await run(options)
  if (exitCode !== 0 && exitCode !== CHECKPOINT_EXIT_CODE)
    throw new Error('Data-chain smoke runner returned an unexpected exit code.')
  const evidence = await loadPair(options, dependencies.read ?? readDefault)
  if (exitCode === 0 && evidence.ingestState === 'resolved' && evidence.aggregate === 'passed')
    return 0
  if (exitCode === CHECKPOINT_EXIT_CODE && validPendingOrCheckpoint(evidence))
    return CHECKPOINT_EXIT_CODE
  throw new Error('Data-chain smoke runner exit code does not match persisted evidence.')
}

export async function runVerifyDataChainSmokeCli(argv: readonly string[] = process.argv.slice(2)): Promise<0 | typeof CHECKPOINT_EXIT_CODE> {
  const options = parseDataChainSmokeArgs(argv)
  if (options.evidenceRoot !== DATA_CHAIN_EVIDENCE_ROOT)
    throw new Error('Data-chain verification requires the fixed Phase 13 evidence root.')
  return verifyDataChainSmoke(options)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runVerifyDataChainSmokeCli().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

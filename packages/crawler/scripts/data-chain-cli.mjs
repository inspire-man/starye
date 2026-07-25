import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'

const entryNames = ['run', 'verify', 'handoff']

const moduleByEntry = Object.freeze({
  run: new URL('../../../scripts/data-chain-smoke.ts', import.meta.url).href,
  verify: new URL('../../../scripts/verify-data-chain-smoke.ts', import.meta.url).href,
  handoff: new URL('../../../scripts/data-chain-handoff.ts', import.meta.url).href,
})

function isEntryName(value) {
  return entryNames.includes(value)
}

function normalizeStatus(entry, status) {
  if (entry === 'handoff') {
    return status === 0 ? 0 : 1
  }
  return status === 0 || status === 1 || status === 2 ? status : 1
}

async function loadProductionDispatch(entry) {
  const module = await tsImport(moduleByEntry[entry], import.meta.url)
  const exportedName = entry === 'run'
    ? 'runDataChainSmokeCli'
    : entry === 'verify'
      ? 'runVerifyDataChainSmokeCli'
      : 'runDataChainHandoffCli'
  const invoke = module[exportedName]
  if (typeof invoke !== 'function') {
    throw new TypeError('data-chain launcher entry is unavailable')
  }
  return invoke
}

export async function dispatchDataChainCli(entry, argv, dependencies) {
  if (!isEntryName(entry)) {
    throw new Error('unknown data-chain launcher entry')
  }
  const invoke = dependencies?.[entry] ?? await loadProductionDispatch(entry)
  const status = await invoke(argv)
  return normalizeStatus(entry, status)
}

async function main() {
  const [entry, ...argv] = process.argv.slice(2)
  if (!isEntryName(entry)) {
    process.exitCode = 1
    return
  }
  try {
    const forwardedArgv = argv[0] === '--' ? argv.slice(1) : argv
    process.exitCode = await dispatchDataChainCli(entry, forwardedArgv)
  }
  catch {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}

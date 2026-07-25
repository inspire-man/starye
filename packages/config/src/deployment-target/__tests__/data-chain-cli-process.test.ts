import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface DataChainCliModule {
  dispatchDataChainCli: (
    entry: 'run' | 'verify' | 'handoff',
    argv: readonly string[],
    dependencies: {
      run: (argv: readonly string[]) => Promise<number>
      verify: (argv: readonly string[]) => Promise<number>
      handoff: (argv: readonly string[]) => Promise<number>
    },
  ) => Promise<0 | 1 | 2>
}

async function loadDataChainCli(): Promise<DataChainCliModule> {
  return import(/* @vite-ignore */ new URL('../../../../crawler/scripts/data-chain-cli.mjs', import.meta.url).href) as Promise<DataChainCliModule>
}

const temporaryRoots: string[] = []
const repositoryRoot = path.resolve(import.meta.dirname, '../../../../..')

async function createProcessHook(
  code: 0 | 1 | 2,
  entry: 'run' | 'verify' | 'handoff',
  reportArgv = false,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-13-14-cli-'))
  temporaryRoots.push(root)
  const moduleByEntry = {
    run: {
      url: pathToFileURL(path.join(repositoryRoot, 'scripts', 'data-chain-smoke.ts')).href,
      exportName: 'runDataChainSmokeCli',
    },
    verify: {
      url: pathToFileURL(path.join(repositoryRoot, 'scripts', 'verify-data-chain-smoke.ts')).href,
      exportName: 'runVerifyDataChainSmokeCli',
    },
    handoff: {
      url: pathToFileURL(path.join(repositoryRoot, 'scripts', 'data-chain-handoff.ts')).href,
      exportName: 'runDataChainHandoffCli',
    },
  } as const
  const fixture = moduleByEntry[entry]
  const hook = path.join(root, 'hook.mjs')
  const preload = path.join(root, 'preload.mjs')
  const message = entry === 'handoff' && code === 2
    ? '{"outcome":"pending","handoffReady":true}'
    : `__data_chain_cli_test__:${entry}:${code}`
  const fixtureSource = [
    `import process from 'node:process';`,
    `export async function ${fixture.exportName}(argv) {`,
    `  process.stdout.write(${JSON.stringify(`${message}\n`)});`,
    ...(reportArgv ? [`  process.stdout.write('__data_chain_cli_argv__:' + JSON.stringify(argv) + '\\n');`] : []),
    `  return ${code};`,
    '}',
  ].join('\n')
  const fixtureByUrl = Object.fromEntries(
    Object.values(moduleByEntry).map(value => [value.url, value]),
  )
  const apiSource = [
    `const fixtureByUrl = ${JSON.stringify(fixtureByUrl)};`,
    `const fixtureUrl = ${JSON.stringify(fixture.url)};`,
    `const fixtureSource = ${JSON.stringify(fixtureSource)};`,
    'export async function tsImport(specifier) {',
    '  if (!Object.hasOwn(fixtureByUrl, specifier)) throw new Error(\'unexpected test module\');',
    '  const fixture = fixtureByUrl[specifier];',
    '  if (specifier !== fixtureUrl) throw new Error(\'unexpected test entry\');',
    '  const module = await import(\'data:text/javascript,\' + encodeURIComponent(fixtureSource));',
    '  return { [fixture.exportName]: async (argv) => module[fixture.exportName](argv) };',
    '}',
  ].join('\n')
  const hookSource = [
    `const apiSource = ${JSON.stringify(apiSource)};`,
    'export async function resolve(specifier, context, nextResolve) {',
    '  if (specifier === \'tsx/esm/api\') {',
    '    return { shortCircuit: true, url: \'data:text/javascript,\' + encodeURIComponent(apiSource) };',
    '  }',
    '  return nextResolve(specifier, context);',
    '}',
  ].join('\n')
  const preloadSource = [
    'import { register } from \'node:module\';',
    'register(new URL(\'./hook.mjs\', import.meta.url), import.meta.url);',
  ].join('\n')
  await writeFile(hook, hookSource, 'utf8')
  await writeFile(preload, preloadSource, 'utf8')
  return pathToFileURL(preload).href
}

function runRootScript(
  scriptName: string,
  preload: string,
  argv: readonly string[] = [],
): Promise<{ exitCode: number, stdout: string, stderr: string }> {
  const pnpmEntry = path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
  return new Promise((resolve, reject) => {
    const pnpmArgv = argv.length > 0 ? ['--', ...argv] : []
    const child = spawn(process.execPath, [pnpmEntry, 'run', scriptName, ...pnpmArgv], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: `--import=${preload}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.once('error', reject)
    child.once('close', exitCode => resolve({ exitCode: exitCode ?? 1, stdout, stderr }))
  })
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('data-chain root launcher', () => {
  it('preserves run and verify status while normalizing handoff to binary status', async () => {
    const { dispatchDataChainCli } = await loadDataChainCli()
    const run = vi.fn(async () => 2)
    const verify = vi.fn(async () => 2)
    const handoff = vi.fn(async () => 2)
    const argv = ['--mode', 'local']

    await expect(dispatchDataChainCli('run', argv, { run, verify, handoff })).resolves.toBe(2)
    await expect(dispatchDataChainCli('verify', argv, { run, verify, handoff })).resolves.toBe(2)
    await expect(dispatchDataChainCli('handoff', argv, { run, verify, handoff })).resolves.toBe(1)
    expect(run).toHaveBeenCalledExactlyOnceWith(argv)
    expect(verify).toHaveBeenCalledExactlyOnceWith(argv)
    expect(handoff).toHaveBeenCalledExactlyOnceWith(argv)
  })

  it('rejects unknown entries and normalizes a thrown fixed entry at the CLI boundary', async () => {
    const { dispatchDataChainCli } = await loadDataChainCli()
    const fail = vi.fn(async () => {
      throw new Error('test-only launcher failure')
    })

    await expect(dispatchDataChainCli('unknown' as never, [], {
      run: fail,
      verify: fail,
      handoff: fail,
    })).rejects.toThrow('unknown data-chain launcher entry')
    expect(fail).not.toHaveBeenCalled()
  })

  it.each([
    ['smoke:data-chain', 'run', 0, 0],
    ['smoke:data-chain', 'run', 1, 1],
    ['smoke:data-chain', 'run', 2, 2],
    ['smoke:data-chain:verify', 'verify', 0, 0],
    ['smoke:data-chain:verify', 'verify', 1, 1],
    ['smoke:data-chain:verify', 'verify', 2, 2],
    ['smoke:data-chain:handoff', 'handoff', 0, 0],
    ['smoke:data-chain:handoff', 'handoff', 1, 1],
    ['smoke:data-chain:handoff', 'handoff', 2, 1],
  ] as const)('maps actual root $scriptName child $code to outer $expectedExit without an evidence override', async (scriptName, entry, code, expectedExit) => {
    const preload = await createProcessHook(code, entry)
    const result = await runRootScript(scriptName, preload)

    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(expectedExit)
    const marker = entry === 'handoff' && code === 2
      ? '{"outcome":"pending","handoffReady":true}'
      : `__data_chain_cli_test__:${entry}:${code}`
    expect(result.stdout.split(marker).length - 1).toBe(1)
    expect(result.stderr).not.toContain('Data-chain smoke requires')
  })

  it.each([
    ['smoke:data-chain', 'run'],
    ['smoke:data-chain:verify', 'verify'],
    ['smoke:data-chain:handoff', 'handoff'],
  ] as const)('strips pnpm\'s single leading delimiter before forwarding $scriptName argv', async (scriptName, entry) => {
    const expectedArgv = ['--mode', 'local', '--target', 'starye-org', '--run-id', 'p13-45-delimiter-regression']
    const preload = await createProcessHook(0, entry, true)
    const result = await runRootScript(scriptName, preload, expectedArgv)

    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(result.stdout).toContain(`__data_chain_cli_argv__:${JSON.stringify(expectedArgv)}`)
    expect(result.stdout).not.toContain('__data_chain_cli_argv__:["--"')
  })

  it.each([
    ['smoke:data-chain', 'run'],
    ['smoke:data-chain:verify', 'verify'],
    ['smoke:data-chain:handoff', 'handoff'],
  ] as const)('removes only pnpm\'s delimiter before forwarding $scriptName argv', async (scriptName, entry) => {
    const expectedArgv = ['--', '--mode', 'local', '--target', 'starye-org', '--run-id', 'p13-45-delimiter-regression']
    const preload = await createProcessHook(0, entry, true)
    const result = await runRootScript(scriptName, preload, expectedArgv)

    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(result.stdout).toContain(`__data_chain_cli_argv__:${JSON.stringify(expectedArgv)}`)
  })

  it('uses only the three direct closed root launchers', async () => {
    const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['smoke:data-chain']).toBe('node packages/crawler/scripts/data-chain-cli.mjs run')
    expect(packageJson.scripts['smoke:data-chain:verify']).toBe('node packages/crawler/scripts/data-chain-cli.mjs verify')
    expect(packageJson.scripts['smoke:data-chain:handoff']).toBe('node packages/crawler/scripts/data-chain-cli.mjs handoff')
  })
})

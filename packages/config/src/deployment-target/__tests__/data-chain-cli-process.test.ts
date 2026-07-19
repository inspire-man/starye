import { describe, expect, it, vi } from 'vitest'

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

describe('data-chain root launcher', () => {
  it('preserves run and verify status while normalizing handoff to binary status', async () => {
    const { dispatchDataChainCli } = await loadDataChainCli()
    const run = vi.fn(async () => 2)
    const verify = vi.fn(async () => 2)
    const handoff = vi.fn(async () => 2)

    await expect(dispatchDataChainCli('run', ['--mode', 'local'], { run, verify, handoff })).resolves.toBe(2)
    await expect(dispatchDataChainCli('verify', ['--mode', 'local'], { run, verify, handoff })).resolves.toBe(2)
    await expect(dispatchDataChainCli('handoff', ['--mode', 'local'], { run, verify, handoff })).resolves.toBe(1)
    expect(run).toHaveBeenCalledOnce()
    expect(verify).toHaveBeenCalledOnce()
    expect(handoff).toHaveBeenCalledOnce()
  })
})

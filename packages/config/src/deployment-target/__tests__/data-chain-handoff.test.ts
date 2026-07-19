import { describe, expect, it } from 'vitest'

interface HandoffModule {
  parseDataChainHandoffArgs: (argv: readonly string[]) => {
    mode: 'local' | 'remote'
    target: string
    runId: string
  }
}

async function loadHandoff(): Promise<HandoffModule> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/data-chain-handoff.ts', import.meta.url).href) as Promise<HandoffModule>
}

describe('data-chain handoff parser', () => {
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
})

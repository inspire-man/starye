import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(import.meta.dirname, '../../..')
const childPath = path.join(import.meta.dirname, 'fixtures', 'data-chain-smoke-auth-timeout-child.ts')
const tsxCli = path.join(path.dirname(process.execPath), 'node_modules', 'tsx', 'dist', 'cli.mjs')
const timeoutBudgetMs = 5000

interface ChildResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  durationMs: number
  exceededBudget: boolean
}

function runAuthTimeoutChild(): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn(process.execPath, [tsxCli, childPath], {
      cwd: packageRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let exceededBudget = false
    const timeout = setTimeout(() => {
      exceededBudget = true
      child.kill()
    }, timeoutBudgetMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (exitCode, signal) => {
      clearTimeout(timeout)
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        exceededBudget,
      })
    })
  })
}

describe('phase 13 Gateway auth timeout process boundary', () => {
  it('persists the checkpoint before naturally exiting well below the outer timeout', async () => {
    const result = await runAuthTimeoutChild()

    expect(result.exceededBudget).toBe(false)
    expect(result.signal).toBeNull()
    expect(result.exitCode).toBe(2)
    expect(result.durationMs).toBeLessThan(timeoutBudgetMs)
    expect(result.stderr).toBe('')

    const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      schema: 'phase13-data-chain-auth-timeout-test-1',
      exitCode: 2,
      checkpoint: 'gateway_auth_timeout',
      peerWrites: 2,
      gatewayAuthFetchCalls: 1,
      downstreamCalls: {
        fixture: 0,
        snapshot: 0,
        gatewayApi: 0,
        browserObserver: 0,
        providerRemote: 0,
      },
    })
  })
})

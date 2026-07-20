import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export interface LocalDevSupervisorInvocation {
  readonly args: readonly string[]
  readonly command: string
  readonly cwd: string
}

export function buildLocalDevSupervisorInvocation(): LocalDevSupervisorInvocation {
  const cwd = path.resolve(import.meta.dirname, '..')

  return {
    command: process.execPath,
    args: ['--import', 'tsx', path.join(cwd, 'scripts', 'local-dev.ts')],
    cwd,
  }
}

function main(): void {
  const invocation = buildLocalDevSupervisorInvocation()
  const child = spawn(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    shell: false,
    stdio: 'inherit',
  })

  const forwardSignal = (signal: NodeJS.Signals): void => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.once('SIGINT', () => forwardSignal('SIGINT'))
  process.once('SIGTERM', () => forwardSignal('SIGTERM'))
  child.once('error', (error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    process.exitCode = code === 0 && signal === null ? 0 : 1
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export function packageManagerInvocation(args) {
  if (process.platform !== 'win32') {
    return { command: 'pnpm', args }
  }
  const entry = path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
  if (!existsSync(entry)) {
    throw new Error('Windows pnpm entrypoint is unavailable.')
  }
  return { command: process.execPath, args: [entry, ...args] }
}

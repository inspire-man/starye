import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import process from 'node:process'
import { auditLegacyDomain } from '../packages/config/src/deployment-target/legacy-domain-audit'

function trackedPaths(root: string): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return output.toString('utf8').split('\0').filter(Boolean)
}

function resolveTrackedPath(root: string, trackedPath: string): string {
  const absolutePath = resolve(root, trackedPath)
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new Error(`Tracked path is outside the repository root: ${trackedPath}`)
  }

  return absolutePath
}

export function runLegacyDomainAuditCli(args: readonly string[] = process.argv.slice(2)): number {
  if (args.length > 0) {
    throw new Error('check:legacy-domain accepts no arguments')
  }

  const root = resolve(process.cwd())
  const result = auditLegacyDomain({
    trackedPaths: trackedPaths(root),
    readFile: trackedPath => readFileSync(resolveTrackedPath(root, trackedPath), 'utf8'),
  })

  if (result.issues.length === 0) {
    process.stdout.write(`Legacy-domain audit passed (${result.allowed.length} explicit allowances).\n`)
    return 0
  }

  for (const issue of result.issues) {
    process.stderr.write(`${issue.diagnostic}\n`)
  }
  return 1
}

process.exitCode = runLegacyDomainAuditCli()

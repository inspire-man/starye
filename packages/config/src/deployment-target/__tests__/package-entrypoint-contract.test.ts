import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { targetRemoteEntryDefinitions } from '../mutation-entry'

const repositoryRoot = path.resolve(import.meta.dirname, '../../../../..')

async function packageScripts(packageName: 'db' | 'crawler'): Promise<Record<string, string>> {
  const filePath = path.join(repositoryRoot, 'packages', packageName, 'package.json')
  const json = JSON.parse(await readFile(filePath, 'utf8')) as { scripts?: Record<string, string> }
  return json.scripts ?? {}
}

describe('package entrypoint contract', () => {
  it('maps every remote DB alias to one closed registry entry', async () => {
    const scripts = await packageScripts('db')
    const entries = targetRemoteEntryDefinitions.filter(entry => entry.family === 'db' || entry.family === 'maintenance')

    for (const entry of entries) {
      if (entry.id === 'monthly-cleanup')
        continue
      expect(Object.values(scripts)).toContain(`tsx ../../scripts/target-remote-entry.ts --entry ${entry.id}`)
    }
    expect(Object.values(scripts).join('\n')).not.toMatch(/wrangler d1 .*--remote|DATABASE_URL|tsx scripts\//)
  })

  it('maps crawler target-reachers to the closed registry and labels retained local helpers', async () => {
    const scripts = await packageScripts('crawler')
    const remoteEntries = targetRemoteEntryDefinitions.filter(entry => entry.family === 'crawler')
    const remoteScripts = Object.entries(scripts).filter(([, command]) => command.includes('target-remote-entry.ts'))

    expect(remoteScripts).toHaveLength(remoteEntries.length)
    for (const entry of remoteEntries) {
      expect(Object.values(scripts)).toContain(`tsx ../../scripts/target-remote-entry.ts --entry ${entry.id}`)
    }
    for (const [name, command] of Object.entries(scripts)) {
      if (command.includes('tsx ') && !command.includes('target-remote-entry.ts')) {
        expect(name).toMatch(/^local:/)
      }
    }
  })
})

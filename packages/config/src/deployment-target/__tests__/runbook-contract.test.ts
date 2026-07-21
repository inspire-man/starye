/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { trackedTargetProfiles } from '../target-profiles'

const runbook = readFileSync(new URL('../../../../../RUNBOOK.md', import.meta.url), 'utf8')

function targetFirstProcedure(document: string): string {
  const start = document.indexOf('## 2. Target-first operations procedure')
  const end = document.indexOf('## 3. Rollback procedure')

  if (start === -1 || end === -1 || end <= start) {
    return ''
  }

  return document.slice(start, end)
}

function requiredSecretRow(profileId: string, secret: {
  readonly name: string
  readonly consumers: readonly string[]
  readonly localFiles: readonly string[]
  readonly ciEnvironment: string
}): string {
  return `| \`${profileId}\` | \`${secret.name}\` | \`${secret.consumers.join(', ')}\` | ${secret.localFiles.length === 0 ? '-' : secret.localFiles.map(file => `\`${file}\``).join(', ')} | \`${secret.ciEnvironment}\` | \`target-profile preflight\` |`
}

function requiredSecretRows(profiles: readonly {
  readonly id: string
  readonly requiredSecrets: readonly {
    readonly name: string
    readonly consumers: readonly string[]
    readonly localFiles: readonly string[]
    readonly ciEnvironment: string
  }[]
}[]): string[] {
  return profiles.flatMap((profile) => {
    if (profile.requiredSecrets.length === 0) {
      return [`| \`${profile.id}\` | No required secrets | - | - | - | \`target-profile preflight\` |`]
    }

    return profile.requiredSecrets.map(secret => requiredSecretRow(profile.id, secret))
  })
}

describe('rUNBOOK target-first operations contract', () => {
  const procedure = targetFirstProcedure(runbook)

  it('orders selected target, local preflight, operator mutation, smoke, and recovery', () => {
    const orderedStages = [
      '### 2.1 Select an explicit TargetProfile',
      '### 2.2 Project local configuration and preflight',
      '### 2.3 Operator-triggered deploy, migration, and crawl',
      '### 2.4 Smoke with mode, target, and run ID',
      '### 2.5 Rollback and recovery',
    ]
    const positions = orderedStages.map(stage => procedure.indexOf(stage))

    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
    expect(procedure).toContain('http://localhost:8080/dashboard/')
    expect(procedure).not.toMatch(/http:\/\/localhost:(?:3000|3001|3002|3003|5173)\//)
    expect(procedure).toContain('[D1 migration safety](#4-d1-migration-safety)')
    expect(procedure).toContain('[Pages rollback](#32-pages-rollback)')
  })

  it('reconciles required-secret guidance to profile metadata without copied identities or values', () => {
    expect(procedure).toContain('### Required-secret metadata matrix')
    for (const row of requiredSecretRows(trackedTargetProfiles)) {
      expect(procedure).toContain(row)
    }

    const profile = trackedTargetProfiles[0]
    const copiedIdentityValues = [
      profile.account.id,
      profile.domain.root,
      profile.domain.zoneName,
      ...Object.values(profile.urls),
      ...Object.values(profile.resources).flatMap((resource) => {
        switch (resource.kind) {
          case 'd1':
            return [resource.name, resource.id]
          case 'r2':
            return [resource.name]
          case 'kv':
            return [resource.id]
        }
      }),
      ...Object.values(profile.workers).map(worker => worker.name),
      ...Object.values(profile.pages).flatMap(page => [page.project, page.directOrigin, page.canonicalUrl]),
    ]

    for (const value of copiedIdentityValues) {
      expect(procedure).not.toContain(value)
    }

    expect(procedure).toContain('No required secrets')
    expect(procedure).not.toMatch(/(?:CLOUDFLARE_API_TOKEN|BETTER_AUTH_SECRET|CRAWLER_SECRET|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)\s*=\s*\S+/)
  })

  it('requires an explicit no-required-secrets row instead of silently omitting an empty profile', () => {
    expect(requiredSecretRows([{ id: 'empty-profile', requiredSecrets: [] }])).toEqual([
      '| `empty-profile` | No required secrets | - | - | - | `target-profile preflight` |',
    ])
  })

  it('treats only passed as complete and makes failed or checkpoint preserve evidence before bounded recovery', () => {
    expect(procedure).toContain('`passed` is the only completed smoke result.')
    expect(procedure).toContain('`failed` and `checkpoint` stop immediately and preserve the current evidence.')
    expect(procedure).toContain('Classify recovery as local, target, or provider handling; do not continue the current run.')
    expect(procedure).toContain('After recovery, start a new validation run with a new mode/target/run ID tuple.')
    expect(procedure).not.toMatch(/\|\s*(?:TEST|DATA|DEPLOY|TARGET)-\d{2}\s*\|/)
    expect(procedure).not.toContain('14-EVIDENCE-MATRIX')
  })
})

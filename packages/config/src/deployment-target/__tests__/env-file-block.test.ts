import { describe, expect, it } from 'vitest'

import {
  applyTargetManagedEnvBlock,
  removeStaleTargetManagedKeys,
  targetManagedBlockEnd,
  targetManagedBlockStart,
} from '../env-file-block'

const targetEntries = {
  STARYE_TARGET_ID: 'starye-org',
  STARYE_TARGET_DOMAIN: 'starye.org',
  STARYE_TARGET_ACCOUNT_ID: 'account-id',
  WEB_URL: 'https://starye.org',
  ADMIN_URL: 'https://dashboard.starye.org',
}

describe('target-managed env block updater', () => {
  it('逐字保留 marker 区域外的 user-managed secret 和无关行', () => {
    const before = 'BETTER_AUTH_SECRET=before-secret\n# operator note\n'
    const after = '\nGITHUB_CLIENT_SECRET=after-secret\nUNRELATED_VALUE=keep-me\n'
    const existing = `${before}${targetManagedBlockStart}\nSTARYE_TARGET_ID=old-target\nWEB_URL=https://old.example\n${targetManagedBlockEnd}${after}`

    const update = applyTargetManagedEnvBlock('apps/api/.dev.vars', existing, targetEntries)

    expect(update.content.startsWith(before)).toBe(true)
    expect(update.content.endsWith(after)).toBe(true)
    expect(update.content).toContain('STARYE_TARGET_ID=starye-org')
    expect(update.content).toContain('WEB_URL=https://starye.org')
  })

  it('以新选择的 target block 替换旧 target identity', () => {
    const existing = [
      targetManagedBlockStart,
      'STARYE_TARGET_ID=old-target',
      'STARYE_TARGET_DOMAIN=old.example',
      'STARYE_TARGET_ACCOUNT_ID=old-account',
      'WEB_URL=https://old.example',
      targetManagedBlockEnd,
    ].join('\n')

    const update = applyTargetManagedEnvBlock('apps/api/.dev.vars', existing, targetEntries)

    expect(update.hadManagedBlock).toBe(true)
    expect(update.content).not.toContain('old-target')
    expect(update.content).not.toContain('old.example')
    expect(update.content).toContain('STARYE_TARGET_ID=starye-org')
  })

  it('只移除 marker 外明确列出的旧 managed keys', () => {
    const existing = [
      'WEB_URL=https://old.example',
      'BETTER_AUTH_SECRET=keep-this-secret',
      'UNRELATED_VALUE=keep-this-value',
      'ADMIN_URL=https://old-admin.example',
      '',
    ].join('\n')

    const update = removeStaleTargetManagedKeys('apps/api/.dev.vars', existing)

    expect(update.content).not.toContain('WEB_URL=https://old.example')
    expect(update.content).not.toContain('ADMIN_URL=https://old-admin.example')
    expect(update.content).toContain('BETTER_AUTH_SECRET=keep-this-secret')
    expect(update.content).toContain('UNRELATED_VALUE=keep-this-value')
    expect(update.removedStaleKeys).toEqual(['WEB_URL', 'ADMIN_URL'])
  })

  it('为空内容生成 managed block，且不伪称 user-managed secret 已存在', () => {
    const update = applyTargetManagedEnvBlock('apps/api/.dev.vars', '', targetEntries)

    expect(update.content).toContain(targetManagedBlockStart)
    expect(update.content).toContain(targetManagedBlockEnd)
    expect(update.content).not.toContain('BETTER_AUTH_SECRET=')
    expect(update.content).not.toContain('GITHUB_CLIENT_SECRET=')
  })

  it('忽略注释、值和 secret 中的 marker 子串，并保留它们的原始字节', () => {
    const existing = [
      `# operator note ${targetManagedBlockStart}`,
      `BETTER_AUTH_SECRET=secret-with-${targetManagedBlockEnd}`,
      'UNRELATED_VALUE=keep-me',
      '',
    ].join('\r\n')

    const update = applyTargetManagedEnvBlock('apps/api/.dev.vars', existing, targetEntries)

    expect(update.hadManagedBlock).toBe(false)
    expect(update.content).toContain(`# operator note ${targetManagedBlockStart}\r\n`)
    expect(update.content).toContain(`BETTER_AUTH_SECRET=secret-with-${targetManagedBlockEnd}\r\n`)
    expect(update.content).toContain('UNRELATED_VALUE=keep-me\r\n')
  })

  it.each([
    [
      'duplicate complete blocks',
      [
        targetManagedBlockStart,
        'STARYE_TARGET_ID=old-target',
        targetManagedBlockEnd,
        'BETTER_AUTH_SECRET=keep-this-secret',
        targetManagedBlockStart,
        'STARYE_TARGET_ID=another-target',
        targetManagedBlockEnd,
      ].join('\n'),
    ],
    [
      'nested start markers',
      [
        targetManagedBlockStart,
        'BETTER_AUTH_SECRET=keep-this-secret',
        targetManagedBlockStart,
        targetManagedBlockEnd,
      ].join('\n'),
    ],
    [
      'duplicate end markers',
      [
        targetManagedBlockStart,
        'BETTER_AUTH_SECRET=keep-this-secret',
        targetManagedBlockEnd,
        targetManagedBlockEnd,
      ].join('\n'),
    ],
    ['end before start', `${targetManagedBlockEnd}\nBETTER_AUTH_SECRET=keep-this-secret\n${targetManagedBlockStart}`],
    ['isolated start marker', `${targetManagedBlockStart}\nBETTER_AUTH_SECRET=keep-this-secret`],
    ['isolated end marker', `BETTER_AUTH_SECRET=keep-this-secret\n${targetManagedBlockEnd}`],
  ])('rejects %s before rewriting operator-managed content', (_name, existing) => {
    expect(() => applyTargetManagedEnvBlock('apps/api/.dev.vars', existing, targetEntries))
      .toThrow('Malformed target-managed env block')
    expect(existing).toContain('BETTER_AUTH_SECRET=keep-this-secret')
  })
})

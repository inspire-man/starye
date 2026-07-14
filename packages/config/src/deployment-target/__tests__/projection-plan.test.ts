import { describe, expect, it } from 'vitest'

import {
  buildLocalEnvProjectionPlan,
  localEnvTargetFiles,
  validateProjectedEnv,
} from '../projection-plan'
import { resolveTargetProfile } from '../target-resolver'

describe('local env projection plan', () => {
  const plan = buildLocalEnvProjectionPlan(resolveTargetProfile('starye-org'))

  it('只建模 D-06 锁定的四个最终 env consumer 文件', () => {
    expect(localEnvTargetFiles).toEqual([
      'apps/api/.dev.vars',
      'apps/gateway/.dev.vars',
      '.env.local',
      'packages/crawler/.env',
    ])
    expect(plan.entries.map(entry => entry.file)).toEqual(localEnvTargetFiles)
  })

  it('将浏览器公开 API 配置固定投影到本地 Gateway canonical URL', () => {
    const rootEnv = plan.entries.find(entry => entry.file === '.env.local')

    expect(rootEnv?.targetManagedEntries).toMatchObject({
      VITE_API_URL: 'http://localhost:8080',
      NUXT_PUBLIC_API_URL: 'http://localhost:8080',
    })
  })

  it('不会为 user-managed secrets 生成具体值', () => {
    const projectedKeys = new Set(
      plan.entries.flatMap(entry => Object.keys(entry.targetManagedEntries)),
    )

    expect(projectedKeys).not.toContain('BETTER_AUTH_SECRET')
    expect(projectedKeys).not.toContain('GITHUB_CLIENT_SECRET')
    expect(projectedKeys).not.toContain('CRAWLER_SECRET')
    expect(projectedKeys).not.toContain('R2_ACCESS_KEY_ID')
    expect(projectedKeys).not.toContain('R2_SECRET_ACCESS_KEY')
  })

  it('仅以 key 名报告缺失的 user-managed secret', () => {
    const issues = validateProjectedEnv(plan, {
      'apps/api/.dev.vars': '',
      'apps/gateway/.dev.vars': '',
      '.env.local': '',
      'packages/crawler/.env': '',
    })

    expect(issues).toContainEqual({
      kind: 'missing-user-managed-secret',
      file: 'apps/api/.dev.vars',
      key: 'BETTER_AUTH_SECRET',
    })
    expect(issues.filter(issue => issue.kind === 'missing-user-managed-secret')).not.toContainEqual(
      expect.objectContaining({ expected: expect.anything() }),
    )
  })
})

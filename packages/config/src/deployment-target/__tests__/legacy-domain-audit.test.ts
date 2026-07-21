import { describe, expect, it } from 'vitest'
import {
  auditLegacyDomain,
  isActiveLegacyDomainAuditPath,
  LEGACY_DOMAIN_ALLOWANCES,
} from '../legacy-domain-audit'

function audit(files: Record<string, string>) {
  return auditLegacyDomain({
    trackedPaths: Object.keys(files),
    readFile: path => files[path] ?? '',
  })
}

describe('legacy-domain audit', () => {
  it('reports an unclassified fixed literal with a deterministic path:line:fragment diagnostic', () => {
    const path = 'apps/example/src/runtime.ts'
    const result = audit({
      [path]: [
        'const targetId = \'starye-org\'',
        'const origin = \'https://starye.org\'',
      ].join('\n'),
    })

    expect(result.issues).toEqual([
      {
        path,
        line: 2,
        fragment: 'const origin = \'https://starye.org\'',
        diagnostic: `${path}:2:const origin = 'https://starye.org'`,
      },
    ])
  })

  it('allows only the exact default target profile fragment with its named reason', () => {
    const path = 'packages/config/src/deployment-target/target-profiles.ts'
    const fragment = 'root: \'starye.org\','
    const result = audit({ [path]: `    ${fragment}\n` })

    expect(result.issues).toEqual([])
    expect(result.allowed).toEqual([
      expect.objectContaining({
        path,
        line: 1,
        fragment,
        allowance: expect.objectContaining({
          category: 'default-target-profile',
          reason: expect.any(String),
        }),
      }),
    ])
  })

  it('allows the exact legacy-alias deny-list fragment but not an altered fragment', () => {
    const path = 'packages/config/src/deployment-target/preflight.ts'
    const allowed = audit({ [path]: '  \'starye.org\',\n' })
    const altered = audit({ [path]: '  \'https://starye.org\',\n' })

    expect(allowed.issues).toEqual([])
    expect(allowed.allowed[0]?.allowance.category).toBe('legacy-alias-deny-list')
    expect(altered.issues).toHaveLength(1)
  })

  it('allows a named test fixture fragment only at its exact path', () => {
    const path = 'packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts'
    const fixture = 'canonicalBase: \'https://starye.org\','

    expect(audit({ [path]: `      ${fixture}\n` }).issues).toEqual([])
    expect(audit({ 'packages/config/src/deployment-target/__tests__/another.test.ts': `      ${fixture}\n` }).issues).toHaveLength(1)
  })

  it('does not treat the hyphenated target identifier as a legacy-domain match', () => {
    const result = audit({
      'packages/config/src/deployment-target/target-profiles.ts': 'id: \'starye-org\',\n',
    })

    expect(result).toEqual({ allowed: [], issues: [] })
  })

  it('filters documentation, planning, ignored local env, and generated output before reads', () => {
    const readPaths: string[] = []
    const result = auditLegacyDomain({
      trackedPaths: [
        'README.md',
        '.planning/phases/14-test-and-operations-hardening/notes.ts',
        'apps/api/.dev.vars',
        'apps/blog/dist/chunk.js',
        'apps/blog/src/runtime.ts',
      ],
      readFile: (path) => {
        readPaths.push(path)
        return 'const origin = \'https://starye.org\''
      },
    })

    expect(readPaths).toEqual(['apps/blog/src/runtime.ts'])
    expect(result.issues).toHaveLength(1)
  })

  it('keeps the active source and config path model explicit', () => {
    expect(isActiveLegacyDomainAuditPath('apps/api/.dev.vars.example')).toBe(true)
    expect(isActiveLegacyDomainAuditPath('apps/auth/typecheck.pages-build.env')).toBe(true)
    expect(isActiveLegacyDomainAuditPath('.github/workflows/pages.yml')).toBe(true)
    expect(isActiveLegacyDomainAuditPath('docs/target-switching.ts')).toBe(false)
    expect(isActiveLegacyDomainAuditPath('apps/blog/public/_redirects')).toBe(false)
    expect(LEGACY_DOMAIN_ALLOWANCES.every(allowance => allowance.path && allowance.fragment && allowance.category && allowance.reason)).toBe(true)
  })
})

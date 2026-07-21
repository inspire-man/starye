const LEGACY_DOMAIN = ['starye', 'org'].join('.')

const SOURCE_SUFFIXES = [
  '.cjs',
  '.cts',
  '.css',
  '.env',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.mjs',
  '.mts',
  '.toml',
  '.ts',
  '.tsx',
  '.vue',
  '.yaml',
  '.yml',
] as const

const EXCLUDED_PREFIXES = ['.planning/', 'docs/', 'node_modules/'] as const
const EXCLUDED_SEGMENTS = ['coverage', 'dist', 'node_modules'] as const

export type LegacyDomainAllowanceCategory
  = | 'default-target-profile'
    | 'legacy-alias-deny-list'
    | 'named-test-fixture'

export interface LegacyDomainAllowance {
  path: string
  fragment: string
  category: LegacyDomainAllowanceCategory
  reason: string
}

export interface LegacyDomainAuditMatch {
  path: string
  line: number
  fragment: string
}

export interface LegacyDomainAllowedMatch extends LegacyDomainAuditMatch {
  allowance: LegacyDomainAllowance
}

export interface LegacyDomainAuditIssue extends LegacyDomainAuditMatch {
  diagnostic: string
}

export interface LegacyDomainAuditOptions {
  trackedPaths: Iterable<string>
  readFile: (path: string) => string
}

export interface LegacyDomainAuditResult {
  allowed: LegacyDomainAllowedMatch[]
  issues: LegacyDomainAuditIssue[]
}

function exactAllowances(
  path: string,
  category: LegacyDomainAllowanceCategory,
  reason: string,
  fragments: readonly string[],
): LegacyDomainAllowance[] {
  return fragments.map(fragment => ({ path, fragment, category, reason }))
}

export const LEGACY_DOMAIN_ALLOWANCES: readonly LegacyDomainAllowance[] = [
  ...exactAllowances(
    'packages/config/src/deployment-target/target-profiles.ts',
    'default-target-profile',
    'Defines the explicit tracked default TargetProfile identity and canonical resources.',
    [
      `root: '${LEGACY_DOMAIN}',`,
      `zoneName: '${LEGACY_DOMAIN}',`,
      `gateway: 'https://${LEGACY_DOMAIN}',`,
      `api: 'https://api.${LEGACY_DOMAIN}',`,
      `blog: 'https://blog.${LEGACY_DOMAIN}',`,
      `tavern: 'https://tavern.${LEGACY_DOMAIN}',`,
      `pattern: 'api.${LEGACY_DOMAIN}',`,
      `pattern: '${LEGACY_DOMAIN}',`,
      `pattern: 'www.${LEGACY_DOMAIN}',`,
      `canonicalUrl: 'https://blog.${LEGACY_DOMAIN}',`,
    ],
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/preflight.ts',
    'legacy-alias-deny-list',
    'Rejects legacy domain aliases before target resolution can select a profile.',
    [
      `'${LEGACY_DOMAIN}',`,
      `'www.${LEGACY_DOMAIN}',`,
      `'api.${LEGACY_DOMAIN}',`,
    ],
  ),
  ...exactAllowances(
    'apps/gateway/src/__tests__/cache-consistency.e2e.test.ts',
    'named-test-fixture',
    'Exercises gateway cache consistency against explicit default-target request fixtures.',
    [
      `const request = new Request('https://${LEGACY_DOMAIN}/api/movies?page=1')`,
      `const firstResponse = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `const staleResponse = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `const freshResponse = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
    ],
  ),
  ...exactAllowances(
    'apps/gateway/src/__tests__/cache-middleware.test.ts',
    'named-test-fixture',
    'Exercises gateway cache keys and target routing with explicit request fixtures.',
    [
      `const request = new Request('https://${LEGACY_DOMAIN}/api/movies?page=1')`,
      `const missResponse = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `const hitResponse = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `new Request('https://${LEGACY_DOMAIN}/movie/assets/app.js'),`,
      `'https://movie.${LEGACY_DOMAIN}',`,
      `new Request('https://${LEGACY_DOMAIN}/dashboard/settings'),`,
      `'https://dashboard.${LEGACY_DOMAIN}',`,
      `const request = new Request('https://${LEGACY_DOMAIN}/api/movies')`,
      `const miss = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `const hit = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `const request = new Request('https://${LEGACY_DOMAIN}/api/movies', {`,
      `const r1 = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `const r2 = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `const r = await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `await cachedProxy(request, 'https://api.${LEGACY_DOMAIN}')`,
      `new Request('https://${LEGACY_DOMAIN}/api/auth/get-session'),`,
      `new Request('https://${LEGACY_DOMAIN}/api/auth/get-session', {`,
      `'https://api.${LEGACY_DOMAIN}',`,
    ],
  ),
  ...exactAllowances(
    'apps/gateway/src/__tests__/dashboard-guard.test.ts',
    'named-test-fixture',
    'Exercises dashboard guard behavior with an explicit default-target request fixture.',
    [
      `const req = new Request('https://${LEGACY_DOMAIN}/dashboard/')`,
      `const req = new Request('https://${LEGACY_DOMAIN}/dashboard/', {`,
    ],
  ),
  ...exactAllowances(
    'apps/gateway/src/__tests__/routing.test.ts',
    'named-test-fixture',
    'Exercises gateway routing with explicit default-target request fixtures.',
    [
      `const req = makeRequest('https://${LEGACY_DOMAIN}/auth/start/github')`,
      `makeRequest('https://${LEGACY_DOMAIN}/blog/_nuxt/assets/css/main.css'),`,
      `const req = makeRequest('https://${LEGACY_DOMAIN}/dashboard/movies', {`,
      `const req = makeRequest('https://${LEGACY_DOMAIN}/movie/ABP-123')`,
    ],
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/__tests__/env-file-block.test.ts',
    'named-test-fixture',
    'Exercises the target-managed env block with named default-target values.',
    [
      `STARYE_TARGET_DOMAIN: '${LEGACY_DOMAIN}',`,
      `WEB_URL: 'https://${LEGACY_DOMAIN}',`,
      `ADMIN_URL: 'https://dashboard.${LEGACY_DOMAIN}',`,
      `expect(update.content).toContain('WEB_URL=https://${LEGACY_DOMAIN}')`,
    ],
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/__tests__/pages-redirects.test.ts',
    'named-test-fixture',
    'Exercises selected-target Pages redirect materialization for every Pages surface.',
    [
      `https://starye-dashboard.pages.dev/* https://${LEGACY_DOMAIN}/dashboard/:splat 301!`,
      `https://starye-auth-die.pages.dev/ https://${LEGACY_DOMAIN}/auth/login 301!`,
      `https://starye-auth-die.pages.dev/* https://${LEGACY_DOMAIN}/auth/:splat 301!`,
      `https://starye-blog.pages.dev/* https://${LEGACY_DOMAIN}/blog/:splat 301!`,
      `https://starye-movie-60w.pages.dev/* https://${LEGACY_DOMAIN}/movie/:splat 301!`,
      `https://starye-comic-3jr.pages.dev/* https://${LEGACY_DOMAIN}/comic/:splat 301!`,
    ].map(fragment => `'${fragment}',`),
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/__tests__/preflight.test.ts',
    'named-test-fixture',
    'Exercises the preflight legacy-alias rejection contract.',
    [`it.each(['default', 'prod', 'production', '${LEGACY_DOMAIN}', 'api.${LEGACY_DOMAIN}'])(`],
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts',
    'named-test-fixture',
    'Exercises the TargetProfile schema with the named default target fixture.',
    [
      `gateway: 'https://${LEGACY_DOMAIN}',`,
      `api: 'https://api.${LEGACY_DOMAIN}',`,
      `blog: 'https://blog.${LEGACY_DOMAIN}',`,
      `tavern: 'https://tavern.${LEGACY_DOMAIN}',`,
    ],
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/__tests__/target-projections.test.ts',
    'named-test-fixture',
    'Exercises target projections with named default target URLs.',
    [
      `gatewayBaseUrl: 'https://${LEGACY_DOMAIN}',`,
      `apiBaseUrl: 'https://api.${LEGACY_DOMAIN}',`,
      `expect(current.deploy.workers.gateway.vars.tavernOrigin).toBe('https://tavern.${LEGACY_DOMAIN}')`,
      `VITE_GATEWAY_BASE_URL: 'https://${LEGACY_DOMAIN}',`,
      `VITE_API_BASE_URL: 'https://api.${LEGACY_DOMAIN}',`,
      `NUXT_PUBLIC_GATEWAY_BASE_URL: 'https://${LEGACY_DOMAIN}',`,
    ],
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/__tests__/target-resolver.test.ts',
    'named-test-fixture',
    'Exercises the resolver legacy-alias rejection contract.',
    [`it.each(['production', 'prod', 'default', '${LEGACY_DOMAIN}'])('拒绝 legacy alias %s', (targetId) => {`],
  ),
  ...exactAllowances(
    'packages/config/src/deployment-target/__tests__/workflow-contract.test.ts',
    'named-test-fixture',
    'Asserts workflow sources do not retain a legacy-domain literal.',
    [`expect(source, workflow.file).not.toContain('${LEGACY_DOMAIN}')`],
  ),
]

function normalizePath(path: string): string {
  return path.split('\\').join('/')
}

function isIgnoredLocalEnvironment(path: string): boolean {
  const fileName = path.split('/').at(-1) ?? ''
  return fileName === '.dev.vars'
    || (fileName.startsWith('.env') && !fileName.endsWith('.example'))
}

export function isActiveLegacyDomainAuditPath(inputPath: string): boolean {
  const path = normalizePath(inputPath)
  if (!path || EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return false
  }

  const segments = path.split('/')
  if (segments.some(segment => EXCLUDED_SEGMENTS.includes(segment as typeof EXCLUDED_SEGMENTS[number]))) {
    return false
  }

  if (isIgnoredLocalEnvironment(path)) {
    return false
  }

  const fileName = segments.at(-1) ?? ''
  if (fileName.endsWith('.dev.vars.example') || fileName.endsWith('.env.example')) {
    return true
  }

  return SOURCE_SUFFIXES.some(suffix => path.endsWith(suffix))
}

function findAllowance(path: string, fragment: string): LegacyDomainAllowance | undefined {
  return LEGACY_DOMAIN_ALLOWANCES.find(allowance => allowance.path === path && allowance.fragment === fragment)
}

export function auditLegacyDomain(options: LegacyDomainAuditOptions): LegacyDomainAuditResult {
  const allowed: LegacyDomainAllowedMatch[] = []
  const issues: LegacyDomainAuditIssue[] = []
  const paths = [...options.trackedPaths]
    .map(normalizePath)
    .filter(isActiveLegacyDomainAuditPath)
    .sort((left, right) => left.localeCompare(right))

  for (const path of paths) {
    const lines = options.readFile(path).split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      if (!line.includes(LEGACY_DOMAIN)) {
        continue
      }

      const fragment = line.trim()
      const match = { path, line: index + 1, fragment }
      const allowance = findAllowance(path, fragment)
      if (allowance) {
        allowed.push({ ...match, allowance })
        continue
      }

      issues.push({
        ...match,
        diagnostic: `${path}:${index + 1}:${fragment}`,
      })
    }
  }

  return { allowed, issues }
}

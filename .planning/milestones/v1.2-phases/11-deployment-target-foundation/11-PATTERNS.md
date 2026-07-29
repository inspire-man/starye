# Phase 11: deployment-target-foundation - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 19 new/modified candidates
**Analogs found:** 16 / 19
**Scope source:** `11-CONTEXT.md` D-01..D-16, `11-RESEARCH.md` Wave 0 / Plan 11-01..11-03

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/config/package.json` | config | transform | `packages/api-types/package.json`, `packages/crawler/package.json` | role-match |
| `packages/config/vitest.config.ts` | config | test | `packages/crawler/vitest.config.ts` | exact |
| `packages/config/src/index.ts` | utility | transform | `packages/api-types/src/index.ts` | exact |
| `packages/config/src/deployment-target/index.ts` | utility | transform | `packages/api-types/src/index.ts` | exact |
| `packages/config/src/deployment-target/target-profile.schema.ts` | model/config | transform + validation | `packages/crawler/src/lib/image-processor.ts`, `packages/api-types/src/storage-purpose-policy.ts` | role-match |
| `packages/config/src/deployment-target/target-profiles.ts` | config | transform | `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `apps/dashboard/wrangler.toml`, `.env.example` | partial |
| `packages/config/src/deployment-target/target-resolver.ts` | utility/service | request-response + transform | `packages/api-types/src/storage-purpose-policy.ts` | exact |
| `packages/config/src/deployment-target/projection-plan.ts` | service/utility | transform + file-I/O plan | `.env.example`, `packages/crawler/scripts/check-config.ts` | partial |
| `packages/config/src/deployment-target/env-file-block.ts` | utility | file-I/O + transform | `packages/crawler/scripts/audit-r2-storage.ts` write pattern only | no-close-analog |
| `packages/config/src/deployment-target/preflight.ts` | service/utility | request-response + file-I/O + live validation | `packages/crawler/scripts/audit-r2-storage.ts` | role-match |
| `packages/config/src/deployment-target/live-checks.ts` | service/utility | request-response/live check | `packages/crawler/scripts/audit-r2-storage.ts` env fail-closed pattern | no-close-analog |
| `packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts` | test | transform/validation | `packages/api-types/src/storage-purpose-policy.test.ts` | exact |
| `packages/config/src/deployment-target/__tests__/target-resolver.test.ts` | test | request-response | `packages/api-types/src/storage-purpose-policy.test.ts` | exact |
| `packages/config/src/deployment-target/__tests__/projection-plan.test.ts` | test | transform + file-I/O plan | `packages/crawler/test/audit-r2-storage.test.ts` | role-match |
| `packages/config/src/deployment-target/__tests__/env-file-block.test.ts` | test | file-I/O transform | `packages/crawler/test/audit-r2-storage.test.ts` | role-match |
| `packages/config/src/deployment-target/__tests__/preflight.test.ts` | test | fail-closed validation | `packages/crawler/test/audit-r2-storage.test.ts` | exact |
| `packages/config/src/deployment-target/__tests__/identity-boundary.test.ts` | test | fail-closed validation | `packages/crawler/test/audit-r2-storage.test.ts` | role-match |
| `scripts/target-profile.ts` | script/CLI | request-response + file-I/O | `packages/crawler/scripts/audit-r2-storage.ts`, `packages/crawler/scripts/check-config.ts` | role-match |
| `scripts/pre-deploy-check.ps1` | script | batch + request-response | existing same file | exact-if-modified |

## Pattern Assignments

### `packages/config/package.json` (config, transform)

**Analog:** `packages/api-types/package.json`, `packages/crawler/package.json`

**Package export pattern** (`packages/api-types/package.json` lines 1-15):
```json
{
  "name": "@starye/api-types",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    }
  },
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b"
  }
}
```

**Script pattern** (`packages/crawler/package.json` lines 21-27):
```json
"test": "vitest",
"test:unit": "vitest run",
"build": "tsc",
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"type-check": "tsc --noEmit"
```

**Apply:** add package scripts for `test` and `type-check`; keep existing `./vitest-base` export; add `.` and/or `./deployment-target` exports only if implementation imports outside package need them.

---

### `packages/config/vitest.config.ts` (config, test)

**Analog:** `packages/crawler/vitest.config.ts`

**Shared Vitest merge pattern** (lines 1-16):
```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
/// <reference types="vitest" />
import { baseVitestConfig } from '../../packages/config/vitest-base'

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
    },
  }),
)
```

**Apply:** for `@starye/config`, use `baseVitestConfig` with Node environment; do not copy `happy-dom` unless a test truly needs DOM.

---

### `packages/config/src/index.ts` and `packages/config/src/deployment-target/index.ts` (utility, transform)

**Analog:** `packages/api-types/src/index.ts`

**Barrel export pattern** (lines 1-2):
```typescript
export type { AppType } from '../../../apps/api/dist/src/index'
export * from './storage-purpose-policy'
```

**Apply:** keep barrels shallow and explicit:
```typescript
export * from './deployment-target'
```
and in `deployment-target/index.ts`, export schema/types/resolver/projection/preflight modules without introducing side effects.

---

### `packages/config/src/deployment-target/target-profile.schema.ts` (model/config, validation)

**Analogs:** `packages/crawler/src/lib/image-processor.ts`, `packages/api-types/src/storage-purpose-policy.ts`

**Valibot schema + inferred type pattern** (`image-processor.ts` lines 9-21):
```typescript
import * as v from 'valibot'

export const R2ConfigSchema = v.looseObject({
  accountId: v.pipe(v.string(), v.description('Cloudflare 账户 ID')),
  accessKeyId: v.pipe(v.string(), v.description('R2 访问密钥 ID')),
  secretAccessKey: v.pipe(v.string(), v.description('R2 访问密钥')),
  bucketName: v.pipe(v.string(), v.description('R2 存储桶名称')),
  publicUrl: v.pipe(v.string(), v.url(), v.description('公开访问 URL，例如 https://cdn.starye.com')),
})

export type R2Config = v.InferOutput<typeof R2ConfigSchema>
```

**Validation error pattern** (`image-processor.ts` lines 66-80):
```typescript
const validation = v.safeParse(R2ConfigSchema, config)
if (!validation.success) {
  const errorMessage = validation.issues.map(issue => `  - ${issue.path?.join('.')}: ${issue.message}`).join('\n')
  throw new Error(
    `R2 配置无效:\n${errorMessage}\n\n`
    + '请检查以下环境变量:\n'
    + '  - CLOUDFLARE_ACCOUNT_ID\n'
    + '  - R2_ACCESS_KEY_ID\n'
    + '  - R2_SECRET_ACCESS_KEY\n'
    + '  - R2_BUCKET_NAME\n'
    + '  - R2_PUBLIC_URL\n\n'
  )
}
```

**Typed vocabulary pattern** (`storage-purpose-policy.ts` lines 1-27):
```typescript
export const manualUploadPurposeValues = [
  'cover',
  'avatar',
  'logo',
  'blog_inline',
  'manual_asset',
  'fallback',
  'temp',
] as const

export type ManualUploadPurpose = (typeof manualUploadPurposeValues)[number]

const manualUploadPurposeSet = new Set<ManualUploadPurpose>(manualUploadPurposeValues)

export function isManualUploadPurpose(value: string): value is ManualUploadPurpose {
  return manualUploadPurposeSet.has(value as ManualUploadPurpose)
}
```

**Apply:** use precise literal unions for target IDs, surfaces (`gateway`, `api`, `dashboard`, `auth`, `blog`, `movie`, `comic`, `tavern`), resources, secret consumers, and command scopes. Prefer strict profile parsing; profile must store secret metadata only, never secret values.

---

### `packages/config/src/deployment-target/target-profiles.ts` (config, transform)

**Analogs:** current singleton target surfaces.

**API Worker resource fields** (`apps/api/wrangler.toml` lines 1-33, 35-39):
```toml
name = "starye-api"

[vars]
WEB_URL = "https://starye.org"
ADMIN_URL = "https://dashboard.starye.org"

[[d1_databases]]
binding = "DB"
database_name = "starye-db"
database_id = "72b60b6c-806f-4795-a846-9b0d157b8225"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "starye-media"

[[routes]]
pattern = "api.starye.org"
custom_domain = true

[[kv_namespaces]]
binding = "CACHE"
id = "f7f6a8c2bff84a1d89da528eab4eb559"
```

**Gateway origin/route fields** (`apps/gateway/wrangler.toml` lines 6-18, 24-38):
```toml
[dev]
port = 8080

[vars]
API_ORIGIN = "https://api.starye.org"
AUTH_ORIGIN = "https://starye-auth.pages.dev"
DASHBOARD_ORIGIN = "https://starye-dashboard.pages.dev"
BLOG_ORIGIN = "https://blog.starye.org"
MOVIE_ORIGIN = "https://starye-movie.pages.dev"
COMIC_ORIGIN = "https://starye-comic.pages.dev"
TAVERN_ORIGIN = "https://starye-tavern.pages.dev"

[[routes]]
pattern = "starye.org"
custom_domain = true
```

**Dashboard Pages public env field** (`apps/dashboard/wrangler.toml` lines 1-5):
```toml
name = "starye-dashboard"

[env.production.vars]
VITE_API_URL = "https://api.starye.org"
```

**Local gateway public env baseline** (`.env.example` lines 1-12):
```dotenv
VITE_API_URL=http://localhost:8080
NUXT_PUBLIC_API_URL=http://localhost:8080
# VITE_R2_URL=http://localhost:8080/media
# VITE_ADMIN_URL=http://localhost:8080/dashboard
```

**Apply:** create one tracked non-secret current-target fixture, likely `starye-org`, by reverse-mapping these fields. Include `account.id`, expected `local.wranglerProfile`, `ci.githubEnvironment`, workers/pages names, D1 database ID/name, R2 bucket, KV namespace, routes, and all canonical URLs. Do not infer `profile.urls` from root domain.

---

### `packages/config/src/deployment-target/target-resolver.ts` (utility/service, request-response)

**Analog:** `packages/api-types/src/storage-purpose-policy.ts`

**Normalization + hard error pattern** (lines 55-69, 81-93):
```typescript
function normalizeStorageNamespace(value: string): string {
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '')
}

export function resolveCrawlerManagedAssetPrefix(
  purpose: CrawlerImagePurpose,
  keyNamespace: string,
): string {
  const normalizedKeyNamespace = normalizeStorageNamespace(keyNamespace)
  const rule = crawlerManagedAssetRules[purpose]

  if (rule.allowedNamespaces.some(pattern => pattern.test(normalizedKeyNamespace))) {
    return normalizedKeyNamespace
  }

  throw new Error(`Unsupported ${purpose} namespace: ${normalizedKeyNamespace}. ${rule.errorMessage}`)
}
```

**Apply:** `resolveTargetProfile(targetId, profiles)` must require explicit `targetId`; unknown or missing target throws. No implicit default target and no legacy alias fallback.

---

### `packages/config/src/deployment-target/projection-plan.ts` (service/utility, transform + file-I/O plan)

**Analogs:** `.env.example`, `packages/crawler/scripts/check-config.ts`

**Existing consumer env shape** (`check-config.ts` lines 12-27):
```typescript
const config = {
  r2: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  api: {
    url: process.env.API_URL,
    token: process.env.CRAWLER_SECRET,
  },
}
```

**Completeness check pattern** (`check-config.ts` lines 60-80):
```typescript
const requiredConfigs = [
  { key: 'CLOUDFLARE_ACCOUNT_ID', value: config.r2.accountId },
  { key: 'R2_ACCESS_KEY_ID', value: config.r2.accessKeyId },
  { key: 'R2_SECRET_ACCESS_KEY', value: config.r2.secretAccessKey },
  { key: 'R2_BUCKET_NAME', value: config.r2.bucketName },
  { key: 'R2_PUBLIC_URL', value: config.r2.publicUrl },
  { key: 'API_URL', value: config.api.url },
  { key: 'CRAWLER_SECRET', value: config.api.token },
]

const missingConfigs = requiredConfigs.filter(c => !c.value)

if (missingConfigs.length > 0) {
  missingConfigs.forEach(c => console.log(`  - ${c.key}`))
  process.exit(1)
}
```

**Apply:** produce a projection plan for final consumer files only:
- `apps/api/.dev.vars`
- `apps/gateway/.dev.vars`
- `.env.local`
- `packages/crawler/.env`

The plan should separate target-managed public/resource keys from user-managed secret keys. It should validate secret key presence without logging values.

---

### `packages/config/src/deployment-target/env-file-block.ts` (utility, file-I/O)

**Analog:** no close marker-aware dotenv updater exists. Use only local write/import style from `audit-r2-storage.ts`.

**Node import/write pattern** (`audit-r2-storage.ts` lines 1-6):
```typescript
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import 'dotenv/config'
```

**Minimal required pattern:** implement target-managed block replacement with explicit markers, preserve all user-managed lines byte-for-byte outside the block, and remove stale previous target-managed keys. Tests must cover preservation and stale cleanup. Do not rewrite whole `.dev.vars` / `.env.local` files.

---

### `packages/config/src/deployment-target/preflight.ts` (service/utility, fail-closed)

**Analog:** `packages/crawler/scripts/audit-r2-storage.ts`

**CLI options shape** (lines 22-31):
```typescript
export interface AuditOptions {
  dryRun: boolean
  prefixes: string[]
  sampleLimit: number
  mdOut?: string
  jsonOut?: string
  csvOut?: string
  strictEnv: boolean
  help: boolean
}
```

**Argument parser fail-closed pattern** (lines 487-529, 536-552):
```typescript
export function parseArgs(argv: string[]): AuditOptions {
  const options: AuditOptions = {
    dryRun: false,
    prefixes: [],
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
    strictEnv: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const [flag, inlineValue] = arg.startsWith('--') && arg.includes('=')
      ? arg.split(/=(.*)/s, 2)
      : [arg, undefined]

    const consumeValue = () => {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${flag}`)
      }
      index += 1
      return next
    }

    switch (flag) {
      case '--sample-limit': {
        const value = Number.parseInt(consumeValue(), 10)
        if (Number.isNaN(value) || value < 0) {
          throw new Error('--sample-limit must be a non-negative integer')
        }
        options.sampleLimit = value
        break
      }
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }

  return options
}
```

**Required env hard failure pattern** (lines 566-596):
```typescript
export function resolveAuditEnvironment(env: NodeJS.ProcessEnv, strictEnv: boolean): AuditEnvironment {
  const requiredR2 = [
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ] as const
  const missingR2 = requiredR2.filter(key => !env[key])

  if (missingR2.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missingR2.join(', ')}`)
  }

  const missingStrict = strictEnv
    ? (['CLOUDFLARE_DATABASE_ID', 'CLOUDFLARE_D1_TOKEN'] as const).filter(key => !env[key])
    : []

  if (missingStrict.length > 0) {
    throw new Error(`Missing required strict-env variables: ${missingStrict.join(', ')}`)
  }
}
```

**Apply:** `preflight` should return/throw a typed result for:
- missing selected target
- invalid profile shape
- projected env mismatch
- stale target-managed key residue
- legacy alias / fallback not modeled by selected profile
- local Wrangler profile mismatch
- `CLOUDFLARE_API_TOKEN` shadowing local profile mode
- remote live scope without credentials or missing D1/R2/KV resources

No warning-only branch for identity mismatch.

---

### `packages/config/src/deployment-target/live-checks.ts` (service/utility, live request-response)

**Analog:** no close repo-local Cloudflare read-check wrapper exists.

**Minimal pattern:** keep as a thin dependency-injected executor that accepts argv arrays, not shell-concatenated strings. Use `pnpm exec wrangler` from scripts/plans, and make absent credentials a hard failure for `--scope remote --live`. Keep mutation commands out of Phase 11; only read-style existence checks belong here.

---

### Phase 11 tests under `packages/config/src/deployment-target/__tests__/`

**Analogs:** `packages/api-types/src/storage-purpose-policy.test.ts`, `packages/crawler/test/audit-r2-storage.test.ts`

**Simple pure utility test pattern** (`storage-purpose-policy.test.ts` lines 1-7, 22-37, 59-62):
```typescript
import { describe, expect, it } from 'vitest'
import {
  classifyStorageUrlKind,
  resolveCrawlerManagedAssetPrefix,
} from './storage-purpose-policy'

describe('resolveCrawlerManagedAssetPrefix', () => {
  it('拒绝 chapter-like namespace', () => {
    expect(() => resolveCrawlerManagedAssetPrefix('cover', 'comics/demo-slug/chapter-1')).toThrow(
      'Unsupported cover namespace: comics/demo-slug/chapter-1. Allowed namespaces: movies/<code>, comics/<slug>',
    )
  })
})

it('区分 missing 和 invalid URL', () => {
  expect(classifyStorageUrlKind('', 'https://cdn.example.com')).toBe('missing')
  expect(classifyStorageUrlKind('not-a-url', 'https://cdn.example.com')).toBe('invalid')
})
```

**CLI/preflight test pattern** (`audit-r2-storage.test.ts` lines 1-11, 14-45, 164-178):
```typescript
import { describe, expect, it } from 'vitest'
import {
  parseArgs,
  resolveAuditEnvironment,
} from '../scripts/audit-r2-storage.ts'

it('应解析 dry-run、prefix、sample-limit 和输出参数', () => {
  const options = parseArgs([
    '--dry-run',
    '--prefix',
    'images/,comics/demo',
    '--sample-limit',
    '3',
    '--strict-env',
  ])

  expect(options.sampleLimit).toBe(3)
  expect(options.strictEnv).toBe(true)
})

it('应在缺少 R2 必需环境变量时清晰报错', () => {
  expect(() => resolveAuditEnvironment({
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
  }, false)).toThrow('Missing required R2 environment variables: R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME')
})
```

**Exact Phase 11 test candidates:**
- `target-profile.schema.test.ts`: valid current profile, missing URLs/resources, secret-value leakage rejection.
- `target-resolver.test.ts`: missing `--target`, unknown target, no implicit default, no legacy alias.
- `projection-plan.test.ts`: API/gateway/root/crawler env plans contain only target-managed keys.
- `env-file-block.test.ts`: user-managed secrets preserved, old target-managed residue removed.
- `preflight.test.ts`: profile + projection + command-input mismatch fails closed.
- `identity-boundary.test.ts`: local Wrangler profile mismatch and local token/profile mixing fail; CI environment mapping required.

---

### `scripts/target-profile.ts` (script/CLI, request-response + file-I/O)

**Analog:** `packages/crawler/scripts/audit-r2-storage.ts`

**Import-safe CLI execution pattern** (lines 1502-1524):
```typescript
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  try {
    await runAudit(options)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`R2 storage audit failed: ${message}`)
    process.exit(1)
  }
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectExecution) {
  void main()
}
```

**Apply:** keep CLI thin and import-safe. Export parse/run helpers for tests from `@starye/config`; the root script should only parse commands (`validate`, `project-local`, `preflight`), call config package functions, print non-secret summaries, and exit non-zero on failures.

Expected commands from research:
```bash
pnpm exec tsx scripts/target-profile.ts validate --target starye-org
pnpm exec tsx scripts/target-profile.ts project-local --target starye-org --check
pnpm exec tsx scripts/target-profile.ts preflight --target starye-org --scope local
pnpm exec tsx scripts/target-profile.ts preflight --target starye-org --scope remote --live
```

---

### `scripts/pre-deploy-check.ps1` (script, batch)

**Analog:** existing same file.

**Existing parameter/check accumulator pattern** (lines 4-20):
```powershell
param(
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$Quick
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$AllPassed = $true
$Checks = @()
```

**Existing env section is info-only** (lines 167-180):
```powershell
$RequiredSecrets = @(
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "BETTER_AUTH_SECRET"
)

foreach ($secret in $RequiredSecrets) {
    Write-Host "    - $secret" -ForegroundColor White
}
$Checks += @{ Name = "环境变量"; Status = "Info"; Message = "需手动验证" }
```

**Apply:** if Phase 11 modifies this file, add an explicit selected-target parameter and call the TS preflight. Unlike the current env info block, target identity mismatch must set `$AllPassed = $false` and add a `Fail` check. Keep core target logic in TypeScript for tests.

## Shared Patterns

### Canonical Local URL

**Source:** `.env.example` lines 1-5 and AGENTS local validation rule.

**Apply to:** projection plan, profile URLs, preflight.
```dotenv
VITE_API_URL=http://localhost:8080
NUXT_PUBLIC_API_URL=http://localhost:8080
```

Planner should not introduce `3000/3001/3002/3003/5173` as canonical browser-facing URLs. Direct app ports may remain implementation details in gateway/local routing tests.

### Existing Runtime Config Surfaces Are Inputs, Not Phase 11 Rewrite Targets

**Source:** `apps/auth/nuxt.config.ts` lines 38-43, `apps/blog/nuxt.config.ts` lines 52-57.
```typescript
runtimeConfig: {
  public: {
    apiUrl: env.NUXT_PUBLIC_API_URL || env.VITE_API_URL || 'http://localhost:8080',
    sentryDsn: env.NUXT_PUBLIC_SENTRY_DSN || env.SENTRY_DSN || '',
  },
},
```

**Apply to:** projection/preflight tests. Phase 11 should validate/project env for these consumers; actual frontend runtime switching belongs to Phase 12.

### Legacy Fallback Risk Fixture

**Source:** `apps/api/src/config.ts` lines 3-17, 19-34.
```typescript
const origins = new Set<string>([
  'https://starye.org',
  'https://www.starye.org',
  'http://localhost:3003',
  'http://localhost:5173',
  'http://localhost:8080',
])

if (env.WEB_URL) {
  origins.add(env.WEB_URL)
}
```

**Apply to:** preflight/fixture tests as a known drift surface. Do not clean old literals in Phase 11; that is Phase 14 unless needed as a validation fixture.

### Secret Handling

**Source:** `11-CONTEXT.md` D-04, D-07 and `.env.example`.

**Apply to:** `target-profile.schema.ts`, `target-profiles.ts`, projection/preflight.

Profiles may contain:
- secret name
- required/optional flag
- consumer
- local file or CI environment metadata

Profiles must not contain:
- token values
- OAuth client secrets
- R2 secret access keys
- Better Auth secret values

Tests should assert known secret-like values never appear in tracked profile fixtures or public env projections.

### Fail-Closed Error Policy

**Source:** `audit-r2-storage.ts` lines 566-596 and `11-CONTEXT.md` D-09..D-12.

**Apply to:** resolver, projection check, preflight, CLI.

Copy the pattern of throwing explicit `Error` messages and letting the CLI convert them to non-zero exit. Do not return warning-only status for target identity mismatch.

## No Analog Found

| File | Role | Data Flow | Reason | Minimal Pattern |
|------|------|-----------|--------|-----------------|
| `packages/config/src/deployment-target/target-profiles.ts` | config | transform | Repo has TOML/env singleton target data, but no typed TS target registry. | Use TS `as const` profile fixture, parse it through schema in tests, secret metadata only. |
| `packages/config/src/deployment-target/env-file-block.ts` | utility | file-I/O transform | No existing marker-aware dotenv updater that preserves user-managed secrets. | Implement pure parse/replace helpers first; write wrapper second; test preservation and stale cleanup. |
| `packages/config/src/deployment-target/live-checks.ts` | service/utility | live request-response | No current Cloudflare read-check wrapper; existing scripts use SDK or static env checks. | Use dependency-injected argv executor, read-only Wrangler commands, fail closed without credentials. |

## Reference-Only Surfaces For Phase 11

These files are important inputs for profile reverse-mapping and validation fixtures, but should not be rewritten just to complete Phase 11:

| File | Use |
|------|-----|
| `apps/api/wrangler.toml` | current API Worker/D1/R2/KV/route singleton source |
| `apps/gateway/wrangler.toml` | current gateway origins/routes/dev port source |
| `apps/dashboard/wrangler.toml` | current Pages public API URL source |
| `apps/api/src/config.ts` | known CORS/domain fallback risk fixture |
| `apps/auth/nuxt.config.ts` | Nuxt public API env consumer |
| `apps/blog/nuxt.config.ts` | Nuxt public API env consumer |
| `.github/workflows/*.yml` | CI target/secret-bundle consumers for Phase 12, metadata only in Phase 11 |

## Metadata

**Analog search scope:** `packages/config`, `packages/api-types`, `packages/crawler`, `scripts`, `apps/*/{wrangler,nuxt,vitest}.config`, `.github/workflows`.
**Files scanned:** focused `rg --files` and `rg -n` search over package configs, tests, scripts, Wrangler/Nuxt env surfaces.
**Pattern extraction date:** 2026-07-14.

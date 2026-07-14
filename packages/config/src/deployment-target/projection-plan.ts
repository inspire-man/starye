import type { TargetResolution } from './target-resolver'

export const localEnvTargetFiles = [
  'apps/api/.dev.vars',
  'apps/gateway/.dev.vars',
  '.env.local',
  'packages/crawler/.env',
] as const

export type LocalEnvTargetFile = (typeof localEnvTargetFiles)[number]

const targetIdentityEnvKeys = [
  'STARYE_TARGET_ID',
  'STARYE_TARGET_DOMAIN',
  'STARYE_TARGET_ACCOUNT_ID',
] as const

export const targetManagedEnvKeysByFile = {
  'apps/api/.dev.vars': [
    ...targetIdentityEnvKeys,
    'WEB_URL',
    'ADMIN_URL',
    'BETTER_AUTH_URL',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
  ],
  'apps/gateway/.dev.vars': [
    ...targetIdentityEnvKeys,
    'API_ORIGIN',
    'AUTH_ORIGIN',
    'DASHBOARD_ORIGIN',
    'BLOG_ORIGIN',
    'MOVIE_ORIGIN',
    'COMIC_ORIGIN',
    'TAVERN_ORIGIN',
  ],
  '.env.local': [
    ...targetIdentityEnvKeys,
    'VITE_API_URL',
    'NUXT_PUBLIC_API_URL',
  ],
  'packages/crawler/.env': [
    ...targetIdentityEnvKeys,
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
    'API_URL',
  ],
} as const satisfies Readonly<Record<LocalEnvTargetFile, readonly string[]>>

export type TargetManagedEnvKey = (typeof targetManagedEnvKeysByFile)[LocalEnvTargetFile][number]

export const userManagedSecretKeysByFile = {
  'apps/api/.dev.vars': [
    'BETTER_AUTH_SECRET',
    'GITHUB_CLIENT_SECRET',
    'CRAWLER_SECRET',
    'ADMIN_GITHUB_ID',
  ],
  'apps/gateway/.dev.vars': [
    'ADMIN_GITHUB_ID',
    'SENTRY_DSN',
  ],
  '.env.local': [
    'SENTRY_DSN',
  ],
  'packages/crawler/.env': [
    'CRAWLER_SECRET',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ],
} as const satisfies Readonly<Record<LocalEnvTargetFile, readonly string[]>>

export type UserManagedSecretKey = (typeof userManagedSecretKeysByFile)[LocalEnvTargetFile][number]

export type TargetManagedEnvEntries = Readonly<Partial<Record<TargetManagedEnvKey, string>>>

export interface LocalEnvProjectionEntry {
  file: LocalEnvTargetFile
  targetManagedEntries: TargetManagedEnvEntries
  userManagedSecretKeys: readonly UserManagedSecretKey[]
}

export interface LocalEnvProjectionPlan {
  target: TargetResolution
  entries: readonly LocalEnvProjectionEntry[]
}

export type ProjectionValidationIssue
  = | {
    kind: 'target-managed-mismatch'
    file: LocalEnvTargetFile
    key: TargetManagedEnvKey
    expected: string
    actual?: string
  }
  | {
    kind: 'missing-user-managed-secret'
    file: LocalEnvTargetFile
    key: UserManagedSecretKey
  }

type ProjectedEnvContents = Readonly<Partial<Record<LocalEnvTargetFile, string>>>

const localGatewayUrl = 'http://localhost:8080'

function targetIdentityEntries(resolution: TargetResolution): TargetManagedEnvEntries {
  return {
    STARYE_TARGET_ID: resolution.id,
    STARYE_TARGET_DOMAIN: resolution.profile.domain.root,
    STARYE_TARGET_ACCOUNT_ID: resolution.profile.account.id,
  }
}

function targetR2PublicUrl(resolution: TargetResolution): string {
  return `https://cdn.${resolution.profile.domain.root}`
}

export function buildLocalEnvProjectionPlan(resolution: TargetResolution): LocalEnvProjectionPlan {
  const { profile } = resolution
  const identity = targetIdentityEntries(resolution)

  const entries: LocalEnvProjectionEntry[] = [
    {
      file: 'apps/api/.dev.vars',
      targetManagedEntries: {
        ...identity,
        WEB_URL: profile.urls.gateway,
        ADMIN_URL: profile.urls.dashboard,
        BETTER_AUTH_URL: profile.urls.auth,
        R2_BUCKET_NAME: profile.resources.r2.name,
        R2_PUBLIC_URL: targetR2PublicUrl(resolution),
      },
      userManagedSecretKeys: userManagedSecretKeysByFile['apps/api/.dev.vars'],
    },
    {
      file: 'apps/gateway/.dev.vars',
      targetManagedEntries: {
        ...identity,
        API_ORIGIN: profile.urls.api,
        AUTH_ORIGIN: profile.urls.auth,
        DASHBOARD_ORIGIN: profile.urls.dashboard,
        BLOG_ORIGIN: profile.urls.blog,
        MOVIE_ORIGIN: profile.urls.movie,
        COMIC_ORIGIN: profile.urls.comic,
        TAVERN_ORIGIN: profile.urls.tavern,
      },
      userManagedSecretKeys: userManagedSecretKeysByFile['apps/gateway/.dev.vars'],
    },
    {
      file: '.env.local',
      targetManagedEntries: {
        ...identity,
        VITE_API_URL: localGatewayUrl,
        NUXT_PUBLIC_API_URL: localGatewayUrl,
      },
      userManagedSecretKeys: userManagedSecretKeysByFile['.env.local'],
    },
    {
      file: 'packages/crawler/.env',
      targetManagedEntries: {
        ...identity,
        CLOUDFLARE_ACCOUNT_ID: profile.account.id,
        R2_BUCKET_NAME: profile.resources.r2.name,
        R2_PUBLIC_URL: targetR2PublicUrl(resolution),
        API_URL: profile.urls.api,
      },
      userManagedSecretKeys: userManagedSecretKeysByFile['packages/crawler/.env'],
    },
  ]

  const plan = { target: resolution, entries }
  assertProjectionPlanComplete(plan)
  return plan
}

export function assertProjectionPlanComplete(plan: LocalEnvProjectionPlan): void {
  if (plan.entries.length !== localEnvTargetFiles.length) {
    throw new Error(`Expected ${localEnvTargetFiles.length} local env projection entries.`)
  }

  for (const targetFile of localEnvTargetFiles) {
    const entry = plan.entries.find(candidate => candidate.file === targetFile)

    if (!entry) {
      throw new Error(`Missing local env projection entry: ${targetFile}`)
    }

    for (const markerKey of targetIdentityEnvKeys) {
      if (!entry.targetManagedEntries[markerKey]) {
        throw new Error(`Missing target identity marker ${markerKey} for ${targetFile}`)
      }
    }
  }
}

export function readProjectedEnvValues(content: string): Readonly<Record<string, string>> {
  const values: Record<string, string> = {}

  for (const line of content.split(/\r?\n/)) {
    const separatorIndex = line.indexOf('=')

    if (separatorIndex < 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()

    if (!/^[A-Z_]\w*$/i.test(key)) {
      continue
    }

    const value = line.slice(separatorIndex + 1).trim()
    const isQuoted = (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))

    values[key] = isQuoted ? value.slice(1, -1) : value
  }

  return values
}

export function validateProjectedEnv(
  plan: LocalEnvProjectionPlan,
  contents: ProjectedEnvContents,
): ProjectionValidationIssue[] {
  const issues: ProjectionValidationIssue[] = []

  for (const entry of plan.entries) {
    const values = readProjectedEnvValues(contents[entry.file] ?? '')

    for (const [key, expected] of Object.entries(entry.targetManagedEntries) as [TargetManagedEnvKey, string][]) {
      if (values[key] !== expected) {
        issues.push({
          kind: 'target-managed-mismatch',
          file: entry.file,
          key,
          expected,
          ...(values[key] === undefined ? {} : { actual: values[key] }),
        })
      }
    }

    for (const key of entry.userManagedSecretKeys) {
      if (!values[key]) {
        issues.push({
          kind: 'missing-user-managed-secret',
          file: entry.file,
          key,
        })
      }
    }
  }

  return issues
}

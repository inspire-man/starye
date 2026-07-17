import * as v from 'valibot'

export const targetUrlSurfaceValues = [
  'gateway',
  'api',
  'dashboard',
  'auth',
  'blog',
  'movie',
  'comic',
  'tavern',
] as const

export const requiredTargetUrlSurfaces = targetUrlSurfaceValues

export type TargetUrlSurface = (typeof targetUrlSurfaceValues)[number]

export const targetWorkerSurfaceValues = ['api', 'gateway'] as const

export type TargetWorkerSurface = (typeof targetWorkerSurfaceValues)[number]

export const targetPagesSurfaceValues = [
  'dashboard',
  'auth',
  'blog',
  'movie',
  'comic',
] as const

export type TargetPagesSurface = (typeof targetPagesSurfaceValues)[number]

export const secretConsumerValues = [
  'api',
  'gateway',
  'dashboard',
  'auth',
  'blog',
  'movie',
  'comic',
  'tavern',
  'crawler',
  'ci',
] as const

export type SecretConsumer = (typeof secretConsumerValues)[number]

function requiredText(label: string) {
  return v.pipe(
    v.string(),
    v.check(value => value.trim().length > 0, `${label} must not be empty.`),
  )
}

function canonicalUrl(label: string) {
  return v.pipe(
    requiredText(label),
    v.url(`${label} must be a valid URL.`),
    v.check(value => value.startsWith('https://'), `${label} must use https.`),
  )
}

const targetProfileIdSchema = v.pipe(
  requiredText('Target id'),
  v.check(value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), 'Target id must be kebab-case.'),
)

const routeSchema = v.strictObject({
  pattern: requiredText('Route pattern'),
  customDomain: v.boolean(),
})

const targetWorkerSchema = v.strictObject({
  name: requiredText('Worker name'),
  routes: v.pipe(v.array(routeSchema), v.minLength(1, 'Worker routes must not be empty.')),
})

const targetPageSchema = v.strictObject({
  project: requiredText('Pages project'),
  canonicalUrl: canonicalUrl('Pages canonical URL'),
})

const d1ResourceSchema = v.strictObject({
  kind: v.literal('d1'),
  binding: requiredText('D1 binding'),
  name: requiredText('D1 database name'),
  id: requiredText('D1 database id'),
})

const r2ResourceSchema = v.strictObject({
  kind: v.literal('r2'),
  binding: requiredText('R2 binding'),
  name: requiredText('R2 bucket name'),
})

const kvResourceSchema = v.strictObject({
  kind: v.literal('kv'),
  binding: requiredText('KV binding'),
  id: requiredText('KV namespace id'),
})

export type TargetResourceBinding
  = | v.InferOutput<typeof d1ResourceSchema>
    | v.InferOutput<typeof r2ResourceSchema>
    | v.InferOutput<typeof kvResourceSchema>

const requiredSecretMetadataSchema = v.strictObject({
  name: requiredText('Required secret name'),
  required: v.boolean(),
  consumers: v.pipe(
    v.array(v.picklist(secretConsumerValues)),
    v.minLength(1, 'Required secret consumers must not be empty.'),
  ),
  localFiles: v.array(requiredText('Required secret local file')),
  ciEnvironment: requiredText('Required secret CI environment'),
})

export type RequiredSecretMetadata = v.InferOutput<typeof requiredSecretMetadataSchema>

const targetProfileObjectSchema = v.strictObject({
  id: targetProfileIdSchema,
  account: v.strictObject({
    id: requiredText('Cloudflare account id'),
    name: requiredText('Cloudflare account name'),
  }),
  domain: v.strictObject({
    root: requiredText('Root domain'),
    zoneName: requiredText('Zone name'),
  }),
  local: v.strictObject({
    wranglerProfile: requiredText('Wrangler profile'),
  }),
  ci: v.strictObject({
    githubEnvironment: requiredText('GitHub environment'),
  }),
  urls: v.strictObject({
    gateway: canonicalUrl('Gateway URL'),
    api: canonicalUrl('API URL'),
    dashboard: canonicalUrl('Dashboard URL'),
    auth: canonicalUrl('Auth URL'),
    blog: canonicalUrl('Blog URL'),
    movie: canonicalUrl('Movie URL'),
    comic: canonicalUrl('Comic URL'),
    tavern: canonicalUrl('Tavern URL'),
  }),
  workers: v.strictObject({
    api: targetWorkerSchema,
    gateway: targetWorkerSchema,
  }),
  pages: v.strictObject({
    dashboard: targetPageSchema,
    auth: targetPageSchema,
    blog: targetPageSchema,
    movie: targetPageSchema,
    comic: targetPageSchema,
  }),
  resources: v.strictObject({
    d1: d1ResourceSchema,
    r2: r2ResourceSchema,
    kv: kvResourceSchema,
  }),
  requiredSecrets: v.pipe(
    v.array(requiredSecretMetadataSchema),
    v.minLength(1, 'Required secrets metadata must not be empty.'),
  ),
})

function hasCanonicalResourceLinks(profile: v.InferOutput<typeof targetProfileObjectSchema>): boolean {
  const apiHost = new URL(profile.urls.api).hostname
  const gatewayHost = new URL(profile.urls.gateway).hostname

  return (
    profile.workers.api.routes.some(route => route.pattern === apiHost)
    && profile.workers.gateway.routes.some(route => route.pattern === gatewayHost)
    && targetPagesSurfaceValues.every(surface => profile.pages[surface].canonicalUrl === profile.urls[surface])
  )
}

export const targetProfileSchema = v.pipe(
  targetProfileObjectSchema,
  v.check(
    hasCanonicalResourceLinks,
    'Worker routes and Pages canonical URLs must match the explicit URL surfaces.',
  ),
)

export type TargetProfile = v.InferOutput<typeof targetProfileSchema>
export type TargetProfileId = TargetProfile['id']

interface TargetProfileIssue {
  message: string
  path?: readonly {
    key?: unknown
  }[]
}

export function formatTargetProfileIssues(issues: readonly TargetProfileIssue[]): string {
  const details = issues
    .map((issue) => {
      const path = issue.path?.map(item => String(item.key ?? '?')).join('.') ?? 'profile'
      return `- ${path}: ${issue.message}`
    })
    .join('\n')

  return `Target profile is invalid:\n${details}`
}

export function parseTargetProfile(input: unknown): TargetProfile {
  const result = v.safeParse(targetProfileSchema, input)

  if (!result.success) {
    throw new Error(formatTargetProfileIssues(result.issues))
  }

  return result.output
}

export function assertTargetProfile(input: unknown): asserts input is TargetProfile {
  parseTargetProfile(input)
}

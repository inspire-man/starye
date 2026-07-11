import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import 'dotenv/config'

export type PolicyClass
  = | 'standard_allowed'
    | 'restricted_allowed'
    | 'restricted_allowed_growth_risk'
    | 'short_term_allowed'
    | 'historical_risk'
    | 'discovered_unlisted_prefix'
    | 'restricted_pending_classification'
    | 'forbidden_risk_baseline'

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical'
export type DbReferenceStatus = 'checked' | 'partial' | 'missing_credentials' | 'missing_query_context' | 'not_applicable'

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

export interface AuditEnvironment {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  d1DatabaseId?: string
  d1Token?: string
  publicUrl?: string
}

export interface ListedObjectLike {
  Key?: string
  Size?: number
  LastModified?: Date
}

export interface AuditRow {
  prefix: string
  source_kind: string
  writer: string
  caller_or_schedule: string
  policy_class: PolicyClass
  object_count: number
  rough_size_bytes: number
  sample_keys: string[]
  oldest_last_modified: string | null
  newest_last_modified: string | null
  db_reference_status: DbReferenceStatus
  db_reference_hits: number | null
  referenced_tables_fields: string[]
  docs_references: string[]
  delete_risk: RiskLevel
  cost_risk: RiskLevel
  combined_recommendation: string
  evidence_sources: string[]
  notes: string[]
}

interface AuditMetadata {
  generatedAt: string
  dryRun: boolean
  strictEnv: boolean
  bucketName: string
  scanRoots: string[]
  includedPrefixes: string[]
  dbChecksAttempted: boolean
  noDeleteConfirmed: true
  notes: string[]
}

interface GroupConfig {
  prefix: string
  sourceKind: string
  writer: string
  callerOrSchedule: string
  policyClass: PolicyClass
  docsReferences: string[]
  evidenceSources: string[]
  baseDeleteRisk: RiskLevel
  baseCostRisk: RiskLevel
  staticNotes: string[]
  recommendationHint: string
  dbPlan: 'generic_asset' | 'comic_cover' | 'comic_chapter' | 'not_applicable'
}

interface DbQuerySpec {
  fieldRef: string
  sql: string
  params: string[]
}

interface DbReferenceResult {
  status: DbReferenceStatus
  hits: number | null
  referencedFields: string[]
  notes: string[]
}

interface D1QueryEnvelope {
  success?: boolean
  errors?: Array<{ message?: string }>
  result?: Array<{
    success?: boolean
    results?: Array<Record<string, unknown>>
  }>
}

const DEFAULT_SAMPLE_LIMIT = 5
const LIST_PAGE_SIZE = 1000
const DEFAULT_SCAN_ROOTS = [
  'covers/',
  'avatars/',
  'logos/',
  'fallback/',
  'manual-assets/',
  'mappings/',
  'tmp/',
  'crawler-debug/',
  'import-staging/',
  'images/',
  'system/',
  'ops/d1-backups/',
  'comics/',
] as const

const GROUP_ORDER = [
  'covers/',
  'avatars/',
  'logos/',
  'fallback/',
  'manual-assets/',
  'mappings/',
  'mappings/backups/',
  'tmp/',
  'crawler-debug/',
  'import-staging/',
  'images/',
  'system/',
  'ops/d1-backups/',
  'comics/<slug>',
  'comics/<slug>/<chapter>',
] as const

const PHASE_DOC_ROOT = '.planning/phases/06-storage-policy-audit'

const GROUP_CONFIGS: Record<(typeof GROUP_ORDER)[number], GroupConfig> = {
  'covers/': {
    prefix: 'covers/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 allowlist baseline',
    callerOrSchedule: 'Requires explicit future writer confirmation before cleanup',
    policyClass: 'standard_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'medium',
    baseCostRisk: 'low',
    staticNotes: ['Standard allowed asset prefix from 06-STORAGE-POLICY.md.'],
    recommendationHint: 'Treat as necessary asset storage and verify active references before any cleanup.',
    dbPlan: 'generic_asset',
  },
  'avatars/': {
    prefix: 'avatars/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 allowlist baseline',
    callerOrSchedule: 'Requires explicit future writer confirmation before cleanup',
    policyClass: 'standard_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'medium',
    baseCostRisk: 'low',
    staticNotes: ['Standard allowed asset prefix from 06-STORAGE-POLICY.md.'],
    recommendationHint: 'Treat as necessary asset storage and verify active references before any cleanup.',
    dbPlan: 'generic_asset',
  },
  'logos/': {
    prefix: 'logos/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 allowlist baseline',
    callerOrSchedule: 'Requires explicit future writer confirmation before cleanup',
    policyClass: 'standard_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'medium',
    baseCostRisk: 'low',
    staticNotes: ['Standard allowed asset prefix from 06-STORAGE-POLICY.md.'],
    recommendationHint: 'Treat as necessary asset storage and verify active references before any cleanup.',
    dbPlan: 'generic_asset',
  },
  'fallback/': {
    prefix: 'fallback/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 allowlist baseline',
    callerOrSchedule: 'Requires explicit future writer confirmation before cleanup',
    policyClass: 'standard_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'low',
    baseCostRisk: 'low',
    staticNotes: ['Fallback assets are allowed but must not become proxy cache storage.'],
    recommendationHint: 'Keep small and explicitly documented; confirm no fallback objects mask broader proxy storage drift.',
    dbPlan: 'generic_asset',
  },
  'manual-assets/': {
    prefix: 'manual-assets/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 allowlist baseline',
    callerOrSchedule: 'Requires explicit future writer confirmation before cleanup',
    policyClass: 'standard_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'medium',
    baseCostRisk: 'low',
    staticNotes: ['Manual assets remain allowed only for explicit owner-approved uploads.'],
    recommendationHint: 'Retain as long-lived assets and confirm owner-approved usage before cleanup.',
    dbPlan: 'generic_asset',
  },
  'mappings/': {
    prefix: 'mappings/',
    sourceKind: 'runtime_prefix_group',
    writer: 'MappingFileManager; admin crawler API; verification scripts',
    callerOrSchedule: 'daily actor crawl; daily publisher crawl; POST /api/admin/crawlers/add-mapping; verify-r2-upload.ts',
    policyClass: 'restricted_allowed',
    docsReferences: [
      `${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`,
      `${PHASE_DOC_ROOT}/06-R2-WRITE-INVENTORY.md`,
      `${PHASE_DOC_ROOT}/06-RISK-BASELINES.md`,
    ],
    evidenceSources: [
      'packages/crawler/src/lib/mapping-file-manager.ts',
      'apps/api/src/routes/admin/crawlers/index.ts',
      'packages/crawler/scripts/verify-r2-upload.ts',
    ],
    baseDeleteRisk: 'medium',
    baseCostRisk: 'medium',
    staticNotes: ['Restricted allowed prefix; backups must stay isolated from the primary mapping row.'],
    recommendationHint: 'Retain for active mapping workflows and audit backup growth separately.',
    dbPlan: 'not_applicable',
  },
  'mappings/backups/': {
    prefix: 'mappings/backups/',
    sourceKind: 'runtime_prefix_group',
    writer: 'MappingFileManager; admin crawler API; verification scripts',
    callerOrSchedule: 'daily actor crawl; daily publisher crawl; POST /api/admin/crawlers/add-mapping; verify-r2-upload.ts',
    policyClass: 'restricted_allowed_growth_risk',
    docsReferences: [
      `${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`,
      `${PHASE_DOC_ROOT}/06-R2-WRITE-INVENTORY.md`,
      `${PHASE_DOC_ROOT}/06-RISK-BASELINES.md`,
    ],
    evidenceSources: [
      'packages/crawler/src/lib/mapping-file-manager.ts',
      'apps/api/src/routes/admin/crawlers/index.ts',
      'packages/crawler/scripts/verify-r2-upload.ts',
    ],
    baseDeleteRisk: 'low',
    baseCostRisk: 'high',
    staticNotes: ['Restricted allowed backup prefix with explicit growth risk from 06-R2-WRITE-INVENTORY.md.'],
    recommendationHint: 'Keep as controlled backup inventory only; prioritize retention and count guardrails.',
    dbPlan: 'not_applicable',
  },
  'tmp/': {
    prefix: 'tmp/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 short-term allowlist baseline',
    callerOrSchedule: 'Future short-lived runtime or import tooling only',
    policyClass: 'short_term_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'low',
    baseCostRisk: 'medium',
    staticNotes: ['Short-term prefix must eventually carry retention policy and owner responsibility.'],
    recommendationHint: 'Use only with retention windows; if objects exist, verify owner and expiry before cleanup.',
    dbPlan: 'not_applicable',
  },
  'crawler-debug/': {
    prefix: 'crawler-debug/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 short-term allowlist baseline',
    callerOrSchedule: 'Future short-lived crawler diagnostics only',
    policyClass: 'short_term_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'low',
    baseCostRisk: 'medium',
    staticNotes: ['Short-term diagnostics must not become long-lived evidence storage.'],
    recommendationHint: 'Use only with retention windows; if objects exist, verify owner and expiry before cleanup.',
    dbPlan: 'not_applicable',
  },
  'import-staging/': {
    prefix: 'import-staging/',
    sourceKind: 'policy_prefix_group',
    writer: 'Phase 6 short-term allowlist baseline',
    callerOrSchedule: 'Future import staging only',
    policyClass: 'short_term_allowed',
    docsReferences: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    evidenceSources: [`${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`],
    baseDeleteRisk: 'low',
    baseCostRisk: 'medium',
    staticNotes: ['Import staging must stay short-lived and auditable.'],
    recommendationHint: 'Use only with retention windows; if objects exist, verify owner and expiry before cleanup.',
    dbPlan: 'not_applicable',
  },
  'images/': {
    prefix: 'images/',
    sourceKind: 'runtime_prefix_group',
    writer: 'Generic API upload route',
    callerOrSchedule: 'POST /api/upload; dashboard PostEditor direct upload',
    policyClass: 'historical_risk',
    docsReferences: [
      `${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`,
      `${PHASE_DOC_ROOT}/06-R2-WRITE-INVENTORY.md`,
    ],
    evidenceSources: [
      'apps/api/src/routes/upload/index.ts',
      'packages/db/src/schema.ts',
    ],
    baseDeleteRisk: 'high',
    baseCostRisk: 'high',
    staticNotes: ['Historical generic prefix: Phase 6 audits it but does not classify it as approved future storage.'],
    recommendationHint: 'Do not delete or rename in Phase 6; confirm concrete DB references and later reclassify or migrate.',
    dbPlan: 'generic_asset',
  },
  'system/': {
    prefix: 'system/',
    sourceKind: 'runtime_prefix_group',
    writer: 'Search index build script',
    callerOrSchedule: 'daily-manga-crawl workflow; build-search.ts',
    policyClass: 'discovered_unlisted_prefix',
    docsReferences: [
      `${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`,
      `${PHASE_DOC_ROOT}/06-R2-WRITE-INVENTORY.md`,
    ],
    evidenceSources: [
      'packages/crawler/scripts/build-search.ts',
      `${PHASE_DOC_ROOT}/06-RESEARCH.md`,
    ],
    baseDeleteRisk: 'high',
    baseCostRisk: 'medium',
    staticNotes: ['Discovered unlisted system prefix; later operations classification is required before cleanup.'],
    recommendationHint: 'Classify operational ownership first; do not treat as standard media asset storage.',
    dbPlan: 'not_applicable',
  },
  'ops/d1-backups/': {
    prefix: 'ops/d1-backups/',
    sourceKind: 'runtime_prefix_group',
    writer: 'deploy-migrations.yml backup step',
    callerOrSchedule: 'manual migration workflow',
    policyClass: 'discovered_unlisted_prefix',
    docsReferences: [
      `${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`,
      `${PHASE_DOC_ROOT}/06-R2-WRITE-INVENTORY.md`,
    ],
    evidenceSources: [
      '.github/workflows/deploy-migrations.yml',
      `${PHASE_DOC_ROOT}/06-RESEARCH.md`,
    ],
    baseDeleteRisk: 'critical',
    baseCostRisk: 'medium',
    staticNotes: ['D1 backup objects are an operations exception, not a standard media prefix.'],
    recommendationHint: 'Treat as operations backup inventory and require explicit restore/retention policy before cleanup.',
    dbPlan: 'not_applicable',
  },
  'comics/<slug>': {
    prefix: 'comics/<slug>',
    sourceKind: 'runtime_prefix_group',
    writer: 'comic-crawler cover processing',
    callerOrSchedule: 'daily-manga-crawl workflow via ImageProcessor cover uploads',
    policyClass: 'restricted_pending_classification',
    docsReferences: [
      `${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`,
      `${PHASE_DOC_ROOT}/06-R2-WRITE-INVENTORY.md`,
    ],
    evidenceSources: [
      'packages/crawler/src/crawlers/comic-crawler.ts',
      'packages/crawler/src/lib/image-processor.ts',
      'packages/db/src/schema.ts',
    ],
    baseDeleteRisk: 'high',
    baseCostRisk: 'medium',
    staticNotes: ['Cover assets must stay separate from forbidden chapter-body storage.'],
    recommendationHint: 'Keep distinct from chapter-body mirrors and validate cover references before any cleanup.',
    dbPlan: 'comic_cover',
  },
  'comics/<slug>/<chapter>': {
    prefix: 'comics/<slug>/<chapter>',
    sourceKind: 'runtime_prefix_group',
    writer: 'comic-crawler chapter page processing',
    callerOrSchedule: 'daily-manga-crawl workflow via ImageProcessor chapter uploads',
    policyClass: 'forbidden_risk_baseline',
    docsReferences: [
      `${PHASE_DOC_ROOT}/06-STORAGE-POLICY.md`,
      `${PHASE_DOC_ROOT}/06-R2-WRITE-INVENTORY.md`,
      `${PHASE_DOC_ROOT}/06-RISK-BASELINES.md`,
    ],
    evidenceSources: [
      'packages/crawler/src/crawlers/comic-crawler.ts',
      'apps/api/src/routes/admin/sync/handlers.ts',
      'apps/api/src/routes/public/comics/index.ts',
      'packages/db/src/schema.ts',
    ],
    baseDeleteRisk: 'critical',
    baseCostRisk: 'critical',
    staticNotes: ['Forbidden-risk baseline: chapter pages must not collapse into the same audit row as comic covers.'],
    recommendationHint: 'Do not delete in Phase 6; confirm API/reader migration away from R2 before any cleanup phase.',
    dbPlan: 'comic_chapter',
  },
}

export const REPORT_FIELD_ORDER = [
  'prefix',
  'source_kind',
  'writer',
  'caller_or_schedule',
  'policy_class',
  'object_count',
  'rough_size_bytes',
  'sample_keys',
  'oldest_last_modified',
  'newest_last_modified',
  'db_reference_status',
  'db_reference_hits',
  'referenced_tables_fields',
  'docs_references',
  'delete_risk',
  'cost_risk',
  'combined_recommendation',
  'evidence_sources',
  'notes',
] as const

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
      if (inlineValue !== undefined) {
        return inlineValue
      }
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${flag}`)
      }
      index += 1
      return next
    }

    switch (flag) {
      case '--dry-run':
        options.dryRun = true
        break
      case '--prefix': {
        const value = consumeValue()
        options.prefixes.push(...value.split(',').map(part => normalizePrefixInput(part)).filter(Boolean))
        break
      }
      case '--sample-limit': {
        const value = Number.parseInt(consumeValue(), 10)
        if (Number.isNaN(value) || value < 0) {
          throw new Error('--sample-limit must be a non-negative integer')
        }
        options.sampleLimit = value
        break
      }
      case '--md-out':
        options.mdOut = consumeValue()
        break
      case '--json-out':
        options.jsonOut = consumeValue()
        break
      case '--csv-out':
        options.csvOut = consumeValue()
        break
      case '--strict-env':
        options.strictEnv = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }

  return options
}

export function normalizePrefixInput(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.includes('<slug>')) {
    return trimmed
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

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

  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucketName: env.R2_BUCKET_NAME!,
    d1DatabaseId: env.CLOUDFLARE_DATABASE_ID,
    d1Token: env.CLOUDFLARE_D1_TOKEN,
    publicUrl: sanitizePublicUrl(env.R2_PUBLIC_URL),
  }
}

function sanitizePublicUrl(publicUrl: string | undefined): string | undefined {
  if (!publicUrl) {
    return undefined
  }
  return publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl
}

export function resolveIncludedGroups(prefixes: string[]): string[] {
  if (prefixes.length === 0) {
    return [...GROUP_ORDER]
  }

  const included = new Set<string>()

  for (const prefix of prefixes) {
    const normalized = normalizePrefixInput(prefix)
    if (!normalized) {
      continue
    }

    if (GROUP_ORDER.includes(normalized as (typeof GROUP_ORDER)[number])) {
      included.add(normalized)
      continue
    }

    if (normalized.startsWith('mappings/backups/')) {
      included.add('mappings/backups/')
      continue
    }

    if (normalized.startsWith('mappings/')) {
      included.add('mappings/')
      continue
    }

    if (normalized.startsWith('ops/d1-backups/')) {
      included.add('ops/d1-backups/')
      continue
    }

    if (normalized.startsWith('system/')) {
      included.add('system/')
      continue
    }

    if (normalized.startsWith('images/')) {
      included.add('images/')
      continue
    }

    if (normalized.startsWith('tmp/')) {
      included.add('tmp/')
      continue
    }

    if (normalized.startsWith('crawler-debug/')) {
      included.add('crawler-debug/')
      continue
    }

    if (normalized.startsWith('import-staging/')) {
      included.add('import-staging/')
      continue
    }

    if (normalized.startsWith('covers/')) {
      included.add('covers/')
      continue
    }

    if (normalized.startsWith('avatars/')) {
      included.add('avatars/')
      continue
    }

    if (normalized.startsWith('logos/')) {
      included.add('logos/')
      continue
    }

    if (normalized.startsWith('fallback/')) {
      included.add('fallback/')
      continue
    }

    if (normalized.startsWith('manual-assets/')) {
      included.add('manual-assets/')
      continue
    }

    if (normalized.startsWith('comics/')) {
      const remainder = normalized.slice('comics/'.length)
      const segments = remainder.split('/').filter(Boolean)

      if (segments.length >= 2) {
        included.add('comics/<slug>/<chapter>')
      }
      else {
        included.add('comics/<slug>')
        included.add('comics/<slug>/<chapter>')
      }
    }
  }

  return [...GROUP_ORDER].filter(prefix => included.has(prefix))
}

export function resolveScanRoots(prefixes: string[]): string[] {
  const roots = prefixes.length === 0
    ? [...DEFAULT_SCAN_ROOTS]
    : prefixes.map((prefix) => {
        const normalized = normalizePrefixInput(prefix)
        if (normalized === 'comics/<slug>' || normalized === 'comics/<slug>/<chapter>') {
          return 'comics/'
        }
        if (normalized.startsWith('comics/')) {
          return normalized
        }
        if (normalized.startsWith('mappings/backups/')) {
          return 'mappings/'
        }
        return normalized
      })

  const unique = [...new Set(roots)]
    .filter(Boolean)
    .sort((left, right) => left.length - right.length)

  const collapsed: string[] = []
  for (const root of unique) {
    const shadowed = collapsed.some(existing => root !== existing && root.startsWith(existing))
    if (!shadowed) {
      collapsed.push(root)
    }
  }

  return collapsed
}

export function classifyObjectKey(key: string): string | null {
  if (!key) {
    return null
  }
  if (key.startsWith('mappings/backups/')) {
    return 'mappings/backups/'
  }
  if (key.startsWith('mappings/')) {
    return 'mappings/'
  }
  if (key.startsWith('ops/d1-backups/')) {
    return 'ops/d1-backups/'
  }
  if (key.startsWith('system/')) {
    return 'system/'
  }
  if (key.startsWith('images/')) {
    return 'images/'
  }
  if (key.startsWith('tmp/')) {
    return 'tmp/'
  }
  if (key.startsWith('crawler-debug/')) {
    return 'crawler-debug/'
  }
  if (key.startsWith('import-staging/')) {
    return 'import-staging/'
  }
  if (key.startsWith('covers/')) {
    return 'covers/'
  }
  if (key.startsWith('avatars/')) {
    return 'avatars/'
  }
  if (key.startsWith('logos/')) {
    return 'logos/'
  }
  if (key.startsWith('fallback/')) {
    return 'fallback/'
  }
  if (key.startsWith('manual-assets/')) {
    return 'manual-assets/'
  }
  if (key.startsWith('comics/')) {
    const segments = key.split('/').filter(Boolean)
    if (segments.length >= 4) {
      return 'comics/<slug>/<chapter>'
    }
    if (segments.length >= 3) {
      return 'comics/<slug>'
    }
  }
  return null
}

export function createEmptyAuditRows(includedPrefixes: string[]): Record<string, AuditRow> {
  return Object.fromEntries(
    includedPrefixes.map((prefix) => {
      const config = GROUP_CONFIGS[prefix as keyof typeof GROUP_CONFIGS]
      const row: AuditRow = {
        prefix: config.prefix,
        source_kind: config.sourceKind,
        writer: config.writer,
        caller_or_schedule: config.callerOrSchedule,
        policy_class: config.policyClass,
        object_count: 0,
        rough_size_bytes: 0,
        sample_keys: [],
        oldest_last_modified: null,
        newest_last_modified: null,
        db_reference_status: 'missing_credentials',
        db_reference_hits: null,
        referenced_tables_fields: [],
        docs_references: [...config.docsReferences],
        delete_risk: config.baseDeleteRisk,
        cost_risk: config.baseCostRisk,
        combined_recommendation: config.recommendationHint,
        evidence_sources: [...config.evidenceSources],
        notes: [...config.staticNotes],
      }
      return [prefix, row]
    }),
  )
}

export function materializeRowsFromObjects(
  objects: ListedObjectLike[],
  includedPrefixes: string[],
  sampleLimit: number,
): AuditRow[] {
  const rowMap = createEmptyAuditRows(includedPrefixes)

  for (const object of objects) {
    const key = object.Key ?? ''
    const classified = classifyObjectKey(key)
    if (!classified || !rowMap[classified]) {
      continue
    }

    const row = rowMap[classified]
    row.object_count += 1
    row.rough_size_bytes += object.Size ?? 0

    if (sampleLimit > 0 && row.sample_keys.length < sampleLimit) {
      row.sample_keys.push(key)
    }

    if (object.LastModified) {
      const timestamp = object.LastModified.toISOString()
      if (!row.oldest_last_modified || timestamp < row.oldest_last_modified) {
        row.oldest_last_modified = timestamp
      }
      if (!row.newest_last_modified || timestamp > row.newest_last_modified) {
        row.newest_last_modified = timestamp
      }
    }
  }

  return includedPrefixes.map(prefix => rowMap[prefix]).map(assessAuditRow)
}

function assessAuditRow(row: AuditRow): AuditRow {
  const assessed = { ...row, sample_keys: [...row.sample_keys], referenced_tables_fields: [...row.referenced_tables_fields], notes: [...row.notes] }

  if (assessed.object_count === 0) {
    assessed.notes.push('No objects were observed for this prefix during the current inventory run.')
    assessed.cost_risk = lowerRisk(assessed.cost_risk)
  }

  if (assessed.object_count >= 1000 || assessed.rough_size_bytes >= 512 * 1024 * 1024) {
    assessed.cost_risk = escalateRisk(assessed.cost_risk, 'high')
  }
  if (assessed.object_count >= 10000 || assessed.rough_size_bytes >= 5 * 1024 * 1024 * 1024) {
    assessed.cost_risk = 'critical'
  }
  if (assessed.prefix === 'mappings/backups/' && assessed.object_count >= 50) {
    assessed.cost_risk = escalateRisk(assessed.cost_risk, 'high')
  }
  if (assessed.prefix === 'images/' && assessed.object_count > 0) {
    assessed.cost_risk = escalateRisk(assessed.cost_risk, 'high')
  }
  if (assessed.prefix === 'comics/<slug>/<chapter>' && assessed.object_count > 0) {
    assessed.cost_risk = 'critical'
  }

  assessed.combined_recommendation = buildRecommendation(assessed)
  return assessed
}

function lowerRisk(risk: RiskLevel): RiskLevel {
  switch (risk) {
    case 'critical':
      return 'high'
    case 'high':
      return 'medium'
    case 'medium':
      return 'low'
    case 'low':
      return 'none'
    default:
      return 'none'
  }
}

function escalateRisk(current: RiskLevel, target: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical']
  return order.indexOf(target) > order.indexOf(current) ? target : current
}

function buildRecommendation(row: AuditRow): string {
  if (row.object_count === 0) {
    return `No objects observed for ${row.prefix}; keep the prefix in the contract but do not infer safety for future writes.`
  }

  if (row.db_reference_status === 'missing_credentials') {
    return `Inventory completed for ${row.prefix}, but DB reference verification is missing credentials. Do not treat db_reference_hits as zero.`
  }

  if (row.db_reference_status === 'missing_query_context' || row.db_reference_status === 'partial') {
    return `Inventory completed for ${row.prefix}, but DB reference verification is incomplete. Confirm query context before any deletion phase.`
  }

  if ((row.db_reference_hits ?? 0) > 0) {
    return `${row.prefix} still appears in D1 references. Preserve it and plan an explicit migration or cleanup phase after callers are removed.`
  }

  return row.combined_recommendation
}

function createS3Client(environment: AuditEnvironment): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${environment.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: environment.accessKeyId,
      secretAccessKey: environment.secretAccessKey,
    },
  })
}

async function listObjectsForPrefix(client: S3Client, bucketName: string, prefix: string): Promise<ListedObjectLike[]> {
  const objects: ListedObjectLike[] = []
  let continuationToken: string | undefined

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: LIST_PAGE_SIZE,
      ContinuationToken: continuationToken,
    }))

    objects.push(...(response.Contents ?? []))
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return objects
}

async function collectListedObjects(client: S3Client, bucketName: string, scanRoots: string[]): Promise<ListedObjectLike[]> {
  const allObjects: ListedObjectLike[] = []

  for (const root of scanRoots) {
    const objects = await listObjectsForPrefix(client, bucketName, root)
    allObjects.push(...objects)
  }

  return allObjects
}

async function hydrateDbReferences(
  rows: AuditRow[],
  environment: AuditEnvironment,
): Promise<void> {
  for (const row of rows) {
    const result = await resolveDbReferencesForRow(row, environment)

    row.db_reference_status = result.status
    row.db_reference_hits = result.hits
    row.referenced_tables_fields = result.referencedFields
    row.notes.push(...result.notes)

    if ((result.hits ?? 0) > 0) {
      row.delete_risk = escalateRisk(row.delete_risk, row.prefix === 'comics/<slug>/<chapter>' ? 'critical' : 'high')
    }
    if (result.status === 'partial' || result.status === 'missing_query_context') {
      row.delete_risk = escalateRisk(row.delete_risk, 'high')
    }
    if (result.status === 'missing_credentials') {
      row.delete_risk = escalateRisk(row.delete_risk, 'medium')
    }

    row.combined_recommendation = buildRecommendation(row)
  }
}

async function resolveDbReferencesForRow(
  row: AuditRow,
  environment: AuditEnvironment,
): Promise<DbReferenceResult> {
  const config = GROUP_CONFIGS[row.prefix as keyof typeof GROUP_CONFIGS]

  if (!environment.d1DatabaseId || !environment.d1Token) {
    return {
      status: 'missing_credentials',
      hits: null,
      referencedFields: [],
      notes: ['D1 reference check skipped because CLOUDFLARE_DATABASE_ID or CLOUDFLARE_D1_TOKEN is missing.'],
    }
  }

  if (config.dbPlan === 'not_applicable') {
    return {
      status: 'not_applicable',
      hits: null,
      referencedFields: [],
      notes: ['No explicit D1 table/field map is defined for this operational or runtime-only prefix.'],
    }
  }

  const specs = buildDbQuerySpecs(row, environment.publicUrl)
  if (specs.available.length === 0) {
    return {
      status: 'missing_query_context',
      hits: null,
      referencedFields: [],
      notes: specs.notes.length > 0
        ? specs.notes
        : ['D1 credentials exist, but no queryable field pattern could be built for this prefix.'],
    }
  }

  const batchResults = await executeD1Batch(environment, specs.available)
  const referencedFields = batchResults.filter(result => result.hits > 0).map(result => result.fieldRef)
  const hits = batchResults.reduce((sum, result) => sum + result.hits, 0)

  return {
    status: specs.missingContext ? 'partial' : 'checked',
    hits,
    referencedFields,
    notes: specs.notes,
  }
}

function buildDbQuerySpecs(
  row: AuditRow,
  publicUrl: string | undefined,
): {
  available: DbQuerySpec[]
  missingContext: boolean
  notes: string[]
} {
  const available: DbQuerySpec[] = []
  const notes: string[] = []
  let missingContext = false

  const addUrlSpec = (fieldRef: string, table: string, field: string, pattern: string | null) => {
    if (!pattern) {
      missingContext = true
      notes.push(`Skipped ${fieldRef} because R2_PUBLIC_URL is not configured.`)
      return
    }
    available.push({
      fieldRef,
      sql: `SELECT COUNT(*) AS hits FROM ${table} WHERE ${field} LIKE ?`,
      params: [pattern],
    })
  }

  switch (row.prefix) {
    case 'covers/':
    case 'avatars/':
    case 'logos/':
    case 'fallback/':
    case 'manual-assets/':
    case 'images/': {
      const keyPattern = `${row.prefix}%`
      const urlPattern = publicUrl ? `${publicUrl}/${row.prefix}%` : null
      available.push({
        fieldRef: 'media.key',
        sql: 'SELECT COUNT(*) AS hits FROM media WHERE key LIKE ?',
        params: [keyPattern],
      })
      addUrlSpec('media.url', 'media', 'url', urlPattern)
      addUrlSpec('post.cover_image', 'post', 'cover_image', urlPattern)
      addUrlSpec('comic.cover_image', 'comic', 'cover_image', urlPattern)
      addUrlSpec('movie.cover_image', 'movie', 'cover_image', urlPattern)
      addUrlSpec('actor.avatar', 'actor', 'avatar', urlPattern)
      addUrlSpec('actor.cover', 'actor', 'cover', urlPattern)
      addUrlSpec('publisher.logo', 'publisher', 'logo', urlPattern)
      addUrlSpec('user.image', 'user', 'image', urlPattern)
      addUrlSpec('page.image_url', 'page', 'image_url', urlPattern)
      break
    }
    case 'comics/<slug>': {
      available.push({
        fieldRef: 'media.key',
        sql: 'SELECT COUNT(*) AS hits FROM media WHERE key LIKE ?',
        params: ['comics/%/cover-%'],
      })
      addUrlSpec('media.url', 'media', 'url', publicUrl ? `${publicUrl}/comics/%/cover-%` : null)
      addUrlSpec('comic.cover_image', 'comic', 'cover_image', publicUrl ? `${publicUrl}/comics/%/cover-%` : null)
      break
    }
    case 'comics/<slug>/<chapter>': {
      available.push({
        fieldRef: 'media.key',
        sql: 'SELECT COUNT(*) AS hits FROM media WHERE key LIKE ?',
        params: ['comics/%/%/%'],
      })
      addUrlSpec('media.url', 'media', 'url', publicUrl ? `${publicUrl}/comics/%/%/%` : null)
      addUrlSpec('page.image_url', 'page', 'image_url', publicUrl ? `${publicUrl}/comics/%/%/%` : null)
      break
    }
  }

  return {
    available,
    missingContext,
    notes,
  }
}

async function executeD1Batch(
  environment: AuditEnvironment,
  specs: DbQuerySpec[],
): Promise<Array<{ fieldRef: string, hits: number }>> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${environment.accountId}/d1/database/${environment.d1DatabaseId}/query`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${environment.d1Token}`,
    },
    body: JSON.stringify({
      batch: specs.map(spec => ({
        sql: spec.sql,
        params: spec.params,
      })),
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Cloudflare D1 query failed: HTTP ${response.status} ${response.statusText} - ${body}`)
  }

  const payload = await response.json() as D1QueryEnvelope
  if (payload.success === false || (payload.errors?.length ?? 0) > 0) {
    const message = payload.errors?.map(error => error.message).filter(Boolean).join('; ') || 'Unknown D1 query error'
    throw new Error(`Cloudflare D1 query failed: ${message}`)
  }

  const queryResults = payload.result ?? []
  if (queryResults.length !== specs.length) {
    throw new Error(`Unexpected D1 batch result size: expected ${specs.length}, received ${queryResults.length}`)
  }

  return specs.map((spec, index) => {
    const batchItem = queryResults[index]
    if (batchItem?.success === false) {
      throw new Error(`Cloudflare D1 query failed for ${spec.fieldRef}`)
    }
    const firstRow = batchItem?.results?.[0]
    const hitsValue = firstRow?.hits
    const hits = typeof hitsValue === 'number'
      ? hitsValue
      : Number.parseInt(String(hitsValue ?? '0'), 10)

    return {
      fieldRef: spec.fieldRef,
      hits: Number.isNaN(hits) ? 0 : hits,
    }
  })
}

function createMetadata(
  rows: AuditRow[],
  options: AuditOptions,
  environment: AuditEnvironment,
  scanRoots: string[],
): AuditMetadata {
  const missingDbChecks = rows.some(row => row.db_reference_status === 'missing_credentials' || row.db_reference_status === 'missing_query_context' || row.db_reference_status === 'partial')
  return {
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    strictEnv: options.strictEnv,
    bucketName: environment.bucketName,
    scanRoots,
    includedPrefixes: rows.map(row => row.prefix),
    dbChecksAttempted: rows.some(row => row.db_reference_status === 'checked' || row.db_reference_status === 'partial' || row.db_reference_status === 'not_applicable'),
    noDeleteConfirmed: true,
    notes: [
      'Phase 6 audit script is read-only by design: it lists R2 objects, optionally queries D1, and writes local reports only.',
      missingDbChecks
        ? 'Some DB reference checks are incomplete. Review row-level db_reference_status before using the report for cleanup planning.'
        : 'DB reference checks completed for all queryable prefixes.',
    ],
  }
}

function renderMarkdownReport(metadata: AuditMetadata, rows: AuditRow[]): string {
  const totalObjects = rows.reduce((sum, row) => sum + row.object_count, 0)
  const totalBytes = rows.reduce((sum, row) => sum + row.rough_size_bytes, 0)
  const docsDeclaredEntries = Array.from(new Set(rows.flatMap(row => row.docs_references)))
  const followUpRows = rows.filter(row =>
    row.delete_risk === 'high'
    || row.delete_risk === 'critical'
    || row.cost_risk === 'high'
    || row.cost_risk === 'critical'
    || row.db_reference_status === 'missing_credentials'
    || row.db_reference_status === 'partial'
    || row.db_reference_status === 'missing_query_context',
  )

  const prefixTable = [
    '| Prefix | Policy Class | Object Count | Rough Size Bytes | DB Reference Status | DB Reference Hits | Delete Risk | Cost Risk | Combined Recommendation |',
    '| --- | --- | ---: | ---: | --- | ---: | --- | --- | --- |',
    ...rows.map(row => `| ${row.prefix} | ${row.policy_class} | ${row.object_count} | ${row.rough_size_bytes} | ${row.db_reference_status} | ${row.db_reference_hits ?? 'n/a'} | ${row.delete_risk} | ${row.cost_risk} | ${escapeMarkdownPipes(row.combined_recommendation)} |`),
  ].join('\n')

  const runtimeWritePaths = rows
    .filter(row => row.source_kind === 'runtime_prefix_group')
    .map(row => `- \`${row.prefix}\`: ${row.writer} | ${row.caller_or_schedule}`)
    .join('\n') || '- None recorded.'

  const dbReferenceChecks = [
    '| Prefix | Status | Hits | Referenced Tables/Fields | Notes |',
    '| --- | --- | ---: | --- | --- |',
    ...rows.map(row => `| ${row.prefix} | ${row.db_reference_status} | ${row.db_reference_hits ?? 'n/a'} | ${escapeMarkdownPipes(row.referenced_tables_fields.join(', ') || 'n/a')} | ${escapeMarkdownPipes(row.notes.join(' '))} |`),
  ].join('\n')

  const followUpCandidates = followUpRows.length > 0
    ? followUpRows.map(row => `- \`${row.prefix}\`: delete_risk=${row.delete_risk}, cost_risk=${row.cost_risk}, db_reference_status=${row.db_reference_status}`).join('\n')
    : '- None.'

  return [
    '# R2 Storage Audit Dry Run',
    '',
    '## Executive Summary',
    '',
    `- Generated at: ${metadata.generatedAt}`,
    `- Bucket: ${metadata.bucketName}`,
    `- Mode: ${metadata.dryRun ? 'dry-run asserted' : 'read-only inventory (no mutation code path exists)'}`,
    `- Scan roots: ${metadata.scanRoots.join(', ')}`,
    `- Total prefix groups: ${rows.length}`,
    `- Total observed objects: ${totalObjects}`,
    `- Total rough size bytes: ${totalBytes}`,
    '',
    '## Prefix Matrix',
    '',
    prefixTable,
    '',
    '## Runtime Write Paths',
    '',
    runtimeWritePaths,
    '',
    '## Docs-Declared Entries',
    '',
    ...docsDeclaredEntries.map(entry => `- \`${entry}\``),
    '',
    '## DB Reference Checks',
    '',
    dbReferenceChecks,
    '',
    '## No-Delete Confirmation',
    '',
    '- This script issues R2 list requests and optional D1 query requests only.',
    '- No object delete, lifecycle apply, upload enforcement, or DB mutation branch exists in this script.',
    '- Local report files are the only write side effects.',
    '',
    '## Follow-up Candidates',
    '',
    followUpCandidates,
    '',
  ].join('\n')
}

function renderJsonReport(metadata: AuditMetadata, rows: AuditRow[]): string {
  return JSON.stringify({
    metadata,
    data: rows,
  }, null, 2)
}

function renderCsvReport(rows: AuditRow[]): string {
  const header = REPORT_FIELD_ORDER.join(',')
  const lines = rows.map((row) => {
    const data = {
      ...row,
      sample_keys: row.sample_keys.join(' | '),
      referenced_tables_fields: row.referenced_tables_fields.join(' | '),
      docs_references: row.docs_references.join(' | '),
      evidence_sources: row.evidence_sources.join(' | '),
      notes: row.notes.join(' | '),
    }
    return REPORT_FIELD_ORDER.map(field => escapeCsvValue(data[field])).join(',')
  })

  return [header, ...lines].join('\n')
}

function escapeCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function escapeMarkdownPipes(value: string): string {
  return value.replaceAll('|', '\\|')
}

async function writeLocalReport(targetPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, content, 'utf8')
}

function printHelp(): void {
  console.log(`Usage: pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts [options]

Options:
  --dry-run                 Assert the no-delete dry-run contract in output metadata
  --prefix <prefix>         Limit inventory to one or more prefixes (repeat or comma separate)
  --sample-limit <number>   Maximum sample keys per prefix row (default: ${DEFAULT_SAMPLE_LIMIT})
  --md-out <path>           Write Markdown report to a local file
  --json-out <path>         Write JSON details report to a local file
  --csv-out <path>          Write CSV details report to a local file
  --strict-env              Require D1 credentials in addition to R2 credentials
  --help                    Show this help text
`)
}

function printSummary(metadata: AuditMetadata, rows: AuditRow[]): void {
  const highRiskRows = rows.filter(row => row.delete_risk === 'high' || row.delete_risk === 'critical' || row.cost_risk === 'high' || row.cost_risk === 'critical')
  console.log('R2 storage audit completed.')
  console.log(`Bucket: ${metadata.bucketName}`)
  console.log(`Scan roots: ${metadata.scanRoots.join(', ')}`)
  console.log(`Included prefixes: ${metadata.includedPrefixes.join(', ')}`)
  console.log(`High-risk rows: ${highRiskRows.length}`)
  for (const row of highRiskRows) {
    console.log(`- ${row.prefix}: delete_risk=${row.delete_risk}, cost_risk=${row.cost_risk}, db_reference_status=${row.db_reference_status}, db_reference_hits=${row.db_reference_hits ?? 'n/a'}`)
  }
}

export async function runAudit(options: AuditOptions, env: NodeJS.ProcessEnv = process.env): Promise<{ metadata: AuditMetadata, rows: AuditRow[] }> {
  const environment = resolveAuditEnvironment(env, options.strictEnv)
  const scanRoots = resolveScanRoots(options.prefixes)
  const includedPrefixes = resolveIncludedGroups(options.prefixes)

  const s3 = createS3Client(environment)
  const listedObjects = await collectListedObjects(s3, environment.bucketName, scanRoots)
  const rows = materializeRowsFromObjects(listedObjects, includedPrefixes, options.sampleLimit)

  await hydrateDbReferences(rows, environment)

  const metadata = createMetadata(rows, options, environment, scanRoots)
  const markdown = renderMarkdownReport(metadata, rows)
  const json = renderJsonReport(metadata, rows)
  const csv = renderCsvReport(rows)

  if (options.mdOut) {
    await writeLocalReport(options.mdOut, markdown)
  }
  if (options.jsonOut) {
    await writeLocalReport(options.jsonOut, json)
  }
  if (options.csvOut) {
    await writeLocalReport(options.csvOut, csv)
  }

  printSummary(metadata, rows)
  return { metadata, rows }
}

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

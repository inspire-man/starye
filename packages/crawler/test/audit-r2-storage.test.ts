import { describe, expect, it } from 'vitest'
import {
  classifyObjectKey,
  cleanupBlockedReason,
  materializeRowsFromObjects,
  parseArgs,
  REPORT_FIELD_ORDER,
  resolveAuditEnvironment,
  resolveIncludedGroups,
  resolveScanRoots,
} from '../scripts/audit-r2-storage.ts'

describe('audit-r2-storage', () => {
  it('应解析 dry-run、prefix、sample-limit 和输出参数', () => {
    const options = parseArgs([
      '--dry-run',
      '--prefix',
      'images/,comics/demo',
      '--prefix',
      'mappings/backups/',
      '--sample-limit',
      '3',
      '--md-out',
      'tmp/report.md',
      '--json-out=tmp/report.json',
      '--csv-out',
      'tmp/report.csv',
      '--strict-env',
    ])

    expect(options).toEqual({
      dryRun: true,
      prefixes: ['images/', 'comics/demo/', 'mappings/backups/'],
      sampleLimit: 3,
      mdOut: 'tmp/report.md',
      jsonOut: 'tmp/report.json',
      csvOut: 'tmp/report.csv',
      strictEnv: true,
      help: false,
    })
  })

  it('应拒绝非法的 sample-limit', () => {
    expect(() => parseArgs(['--sample-limit', '-1'])).toThrow('--sample-limit must be a non-negative integer')
  })

  it('应按 Phase 6 词汇对关键前缀分类', () => {
    expect(classifyObjectKey('images/2026-07-12-demo.png')).toBe('images/')
    expect(classifyObjectKey('mappings/backups/actor-name-map-123.json')).toBe('mappings/backups/')
    expect(classifyObjectKey('system/search-index.json')).toBe('system/')
    expect(classifyObjectKey('ops/d1-backups/starye-db-1.sql')).toBe('ops/d1-backups/')
    expect(classifyObjectKey('comics/demo-slug/cover-original.webp')).toBe('comics/<slug>')
    expect(classifyObjectKey('comics/demo-slug/chapter-1/001-original.webp')).toBe('comics/<slug>/<chapter>')
  })

  it('不应把 comics/<slug> 与 comics/<slug>/<chapter> 折叠成单一 comics 行', () => {
    const rows = materializeRowsFromObjects([
      {
        Key: 'comics/demo-slug/cover-original.webp',
        Size: 128,
        LastModified: new Date('2026-07-12T00:00:00.000Z'),
      },
      {
        Key: 'comics/demo-slug/chapter-1/001-original.webp',
        Size: 256,
        LastModified: new Date('2026-07-12T01:00:00.000Z'),
      },
      {
        Key: 'images/manual-upload.png',
        Size: 64,
        LastModified: new Date('2026-07-12T02:00:00.000Z'),
      },
      {
        Key: 'mappings/backups/actor-name-map-1.json',
        Size: 512,
        LastModified: new Date('2026-07-12T03:00:00.000Z'),
      },
      {
        Key: 'system/search-index.json',
        Size: 1024,
        LastModified: new Date('2026-07-12T04:00:00.000Z'),
      },
      {
        Key: 'ops/d1-backups/starye-db-1.sql',
        Size: 2048,
        LastModified: new Date('2026-07-12T05:00:00.000Z'),
      },
    ], [
      'images/',
      'mappings/backups/',
      'system/',
      'ops/d1-backups/',
      'comics/<slug>',
      'comics/<slug>/<chapter>',
    ], 2)

    const rowMap = Object.fromEntries(rows.map(row => [row.prefix, row]))

    expect(rowMap['comics/<slug>'].object_count).toBe(1)
    expect(rowMap['comics/<slug>'].sample_keys).toEqual(['comics/demo-slug/cover-original.webp'])
    expect(rowMap['comics/<slug>'].policy_class).toBe('restricted_pending_classification')

    expect(rowMap['comics/<slug>/<chapter>'].object_count).toBe(1)
    expect(rowMap['comics/<slug>/<chapter>'].sample_keys).toEqual(['comics/demo-slug/chapter-1/001-original.webp'])
    expect(rowMap['comics/<slug>/<chapter>'].policy_class).toBe('forbidden_risk_baseline')

    expect(rowMap['images/'].object_count).toBe(1)
    expect(rowMap['mappings/backups/'].object_count).toBe(1)
    expect(rowMap['system/'].object_count).toBe(1)
    expect(rowMap['ops/d1-backups/'].object_count).toBe(1)
  })

  it('应把超龄 short-term prefix 标记为 hard failure', () => {
    const rows = materializeRowsFromObjects([
      {
        Key: 'tmp/manual/stale-object.webp',
        Size: 128,
        LastModified: new Date('2026-07-08T00:00:00.000Z'),
      },
    ], ['tmp/'], 2, new Date('2026-07-13T00:00:00.000Z'))

    expect(rows[0].guardrail_status).toBe('hard_failure')
    expect(rows[0].guardrail_findings).toContain('1 object(s) exceed the 3-day retention window')
    expect(rows[0].cleanup_blocked).toBe(true)
  })

  it('应对超龄且超过 recent-20 的 mapping backups 报 hard failure', () => {
    const rows = materializeRowsFromObjects(
      Array.from({ length: 21 }, (_, index) => ({
        Key: `mappings/backups/actor-name-map-${index + 1}.json`,
        Size: 64,
        LastModified: new Date('2026-06-20T00:00:00.000Z'),
      })),
      ['mappings/backups/'],
      2,
      new Date('2026-07-13T00:00:00.000Z'),
    )

    expect(rows[0].guardrail_status).toBe('hard_failure')
    expect(rows[0].guardrail_findings.join(' | ')).toContain('14-day retention window')
    expect(rows[0].guardrail_findings.join(' | ')).toContain('recent-20 cap')
  })

  it('system 和 ops/d1-backups 保持 audit-only，不误报 hard failure', () => {
    const rows = materializeRowsFromObjects([
      {
        Key: 'system/search-index.json',
        Size: 1024,
        LastModified: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        Key: 'ops/d1-backups/starye-db-1.sql',
        Size: 2048,
        LastModified: new Date('2026-05-01T00:00:00.000Z'),
      },
    ], ['system/', 'ops/d1-backups/'], 2, new Date('2026-07-13T00:00:00.000Z'))

    expect(rows[0].guardrail_status).toBe('audit_only')
    expect(rows[0].guardrail_findings).toEqual([])
    expect(rows[1].guardrail_status).toBe('audit_only')
    expect(rows[1].guardrail_findings).toEqual([])
  })

  it('应在无 D1 凭据时 fail closed，并保留缺失原因而不是伪造 0 hits', () => {
    expect(() => resolveAuditEnvironment({
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'bucket-name',
    }, true)).toThrow('Missing required strict-env variables: CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN')
  })

  it('应在缺少 R2 必需环境变量时清晰报错', () => {
    expect(() => resolveAuditEnvironment({
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
      R2_ACCESS_KEY_ID: 'access-key',
    }, false)).toThrow('Missing required R2 environment variables: R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME')
  })

  it('应根据 prefix 输入解析扫描根和包含组', () => {
    expect(resolveScanRoots(['mappings/backups/', 'mappings/'])).toEqual(['mappings/'])
    expect(resolveScanRoots(['comics/demo-slug', 'images/'])).toEqual(['images/', 'comics/demo-slug/'])
    expect(resolveIncludedGroups(['comics/demo-slug/'])).toEqual(['comics/<slug>', 'comics/<slug>/<chapter>'])
    expect(resolveIncludedGroups(['images/', 'system/'])).toEqual(['images/', 'system/'])
  })

  it('partial 或 missing_query_context 的 D1 证据会阻断 cleanup recommendation', () => {
    const [coverRow] = materializeRowsFromObjects([], ['covers/'], 1, new Date('2026-07-13T00:00:00.000Z'))

    expect(cleanupBlockedReason({
      ...coverRow,
      db_reference_status: 'partial',
    })).toBe('D1 reference verification is partial; complete query context before cleanup or lifecycle changes.')

    expect(cleanupBlockedReason({
      ...coverRow,
      db_reference_status: 'missing_query_context',
    })).toBe('D1 reference verification is missing query context; cleanup or lifecycle changes must fail closed.')
  })

  it('应导出约定的报告字段顺序', () => {
    expect(REPORT_FIELD_ORDER).toContain('delete_risk')
    expect(REPORT_FIELD_ORDER).toContain('cost_risk')
    expect(REPORT_FIELD_ORDER).toContain('combined_recommendation')
    expect(REPORT_FIELD_ORDER).toContain('db_reference_hits')
    expect(REPORT_FIELD_ORDER).toContain('db_reference_status')
    expect(REPORT_FIELD_ORDER).toContain('guardrail_status')
    expect(REPORT_FIELD_ORDER).toContain('guardrail_findings')
    expect(REPORT_FIELD_ORDER).toContain('cleanup_blocked')
    expect(REPORT_FIELD_ORDER).toContain('cleanup_blocked_reason')
  })
})

import { describe, expect, it } from 'vitest'
import {
  classifyObjectKey,
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

  it('应导出约定的报告字段顺序', () => {
    expect(REPORT_FIELD_ORDER).toContain('delete_risk')
    expect(REPORT_FIELD_ORDER).toContain('cost_risk')
    expect(REPORT_FIELD_ORDER).toContain('combined_recommendation')
    expect(REPORT_FIELD_ORDER).toContain('db_reference_hits')
    expect(REPORT_FIELD_ORDER).toContain('db_reference_status')
  })
})

import type { RequirementEvidenceMatrix, RequirementEvidenceStatus } from '../requirement-evidence-matrix'
import { describe, expect, it } from 'vitest'

import {
  renderRequirementEvidenceMatrixMarkdown,
  validateRequirementEvidenceMatrix,
} from '../requirement-evidence-matrix'

async function loadMatrixCli(): Promise<{
  verifyV12EvidenceMatrix: (options: {
    final: boolean
    paths: Record<string, string>
    readFile: (path: string) => string | undefined
  }) => { issues: string[] }
}> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/verify-v12-evidence-matrix.ts', import.meta.url).href)
}

const orderedIds = ['PROF-01', 'DATA-01', 'DATA-07', 'TEST-05', 'TEST-07']
const phase13Ids = [
  'DATA-01',
  'DATA-02',
  'DATA-03',
  'DATA-04',
  'DATA-05',
  'DATA-06',
  'DATA-07',
  'TEST-05',
] as const

const phase13RawStatuses = {
  'DATA-01': 'SATISFIED',
  'DATA-02': 'SATISFIED',
  'DATA-03': 'SATISFIED',
  'DATA-04': 'SATISFIED',
  'DATA-05': 'PARTIAL',
  'DATA-06': 'FAILED/CHECKPOINT',
  'DATA-07': 'PARTIAL',
  'TEST-05': 'PARTIAL',
} as const

const phase13PublicStatuses = {
  'DATA-01': 'verified',
  'DATA-02': 'verified',
  'DATA-03': 'verified',
  'DATA-04': 'verified',
  'DATA-05': 'partial',
  'DATA-06': 'blocked',
  'DATA-07': 'partial',
  'TEST-05': 'partial',
} as const

const reports = {
  phase11: '## Requirements Coverage\n| PROF-01 | VERIFIED | profile evidence |',
  phase12: '## Requirement Coverage\n| ENV-03 | VERIFIED | runtime evidence |',
  phase13: [
    '### Requirements Coverage',
    '| DATA-01 | SATISFIED (local) | local terminal chain |',
    '| DATA-02 | SATISFIED (local) | local readiness and tuple |',
    '| DATA-03 | SATISFIED | one-item fixture path |',
    '| DATA-04 | SATISFIED | remote preflight, D1, API, Dashboard |',
    '| DATA-05 | PARTIAL | Viewer terminal absent |',
    '| DATA-06 | FAILED/CHECKPOINT | canonical_viewer_unavailable |',
    '| DATA-07 | PARTIAL | frozen honest checkpoint |',
    '| TEST-05 | PARTIAL | terminal Viewer evidence absent |',
  ].join('\n'),
}

function matrix(ids = orderedIds): RequirementEvidenceMatrix {
  return {
    version: 1,
    requirements: ids.map((id) => {
      const rawStatus = id in phase13RawStatuses
        ? phase13RawStatuses[id as keyof typeof phase13RawStatuses]
        : undefined
      return {
        id,
        sourcePhase: id.startsWith('DATA') || id === 'TEST-05' ? 13 : id === 'TEST-07' ? 14 : 11,
        status: (id in phase13PublicStatuses
          ? phase13PublicStatuses[id as keyof typeof phase13PublicStatuses]
          : 'verified') as RequirementEvidenceStatus,
        evidence: [{ kind: 'verification', path: 'evidence/report.md', anchor: rawStatus ? `| ${id} | ${rawStatus}` : `anchor-${id}` }],
        limitations: ['local static evidence only'],
        ...(rawStatus
          ? { sourceRawStatus: rawStatus }
          : {}),
        ...(id === 'DATA-05' || id === 'DATA-06' || id === 'DATA-07' || id === 'TEST-05'
          ? {
              checkpointOrMissingArtifact: 'p13-66 is frozen without a terminal selected-production Viewer receipt',
              recoveryPrerequisite: 'a later canonical Phase 13 run with terminal Viewer evidence',
              nextOperatorCommand: '$gsd-plan-phase 13 --gaps',
            }
          : {}),
      }
    }),
  }
}

function expectedEvidenceAnchor(id: string): string {
  const rawStatus = id in phase13RawStatuses
    ? phase13RawStatuses[id as keyof typeof phase13RawStatuses]
    : undefined
  return rawStatus ? `| ${id} | ${rawStatus}` : `anchor-${id}`
}

function validate(input: unknown, overrides: Record<string, unknown> = {}) {
  const value = input as ReturnType<typeof matrix>
  return validateRequirementEvidenceMatrix(value, {
    requirementIds: orderedIds,
    canonicalReports: reports,
    readFile: path => path === 'evidence/report.md'
      ? value.requirements.map(row => expectedEvidenceAnchor(row.id)).join('\n')
      : undefined,
    ...overrides,
  })
}

describe('requirement evidence matrix', () => {
  it('accepts ordered unique local evidence and a byte-identical Markdown rendering', () => {
    const value = matrix()
    const markdown = renderRequirementEvidenceMatrixMarkdown(value)

    expect(validate(value, { renderedMarkdown: markdown, final: true })).toEqual([])
  })

  it('maps every current Phase 13 raw status exactly once and exposes it in the Markdown projection', () => {
    const ids = ['PROF-01', ...phase13Ids, 'TEST-07']
    const value = matrix(ids)
    const markdown = renderRequirementEvidenceMatrixMarkdown(value)

    expect(validate(value, { requirementIds: ids, renderedMarkdown: markdown, final: true })).toEqual([])
    expect(markdown).toContain('SATISFIED')
    expect(markdown).toContain('FAILED/CHECKPOINT')
    expect(value.requirements.find(row => row.id === 'DATA-06')).toMatchObject({
      sourceRawStatus: 'FAILED/CHECKPOINT',
      status: 'blocked',
    })
  })

  it.each([
    ['missing', matrix(orderedIds.slice(1))],
    ['extra', matrix([...orderedIds, 'EXTRA-01'])],
    ['duplicate', matrix([...orderedIds.slice(0, 1), orderedIds[0], ...orderedIds.slice(1)])],
    ['out-of-order', matrix([...orderedIds].reverse())],
    ['empty', { version: 1, requirements: [] }],
    ['null row', { version: 1, requirements: [null] }],
    ['single incomplete row', { version: 1, requirements: [{ id: 'PROF-01' }] }],
  ])('rejects %s matrix structure', (_name, value) => {
    expect(validate(value)).not.toEqual([])
  })

  it('rejects invalid status, path, anchor, rendering, recovery fields, and Phase 13 inflation', () => {
    const invalidStatus = matrix()
    invalidStatus.requirements[0]!.status = 'pending' as never
    expect(validate(invalidStatus)).not.toEqual([])

    const absolute = matrix()
    absolute.requirements[0]!.evidence[0]!.path = 'C:/outside/report.md'
    expect(validate(absolute)).not.toEqual([])

    const traversal = matrix()
    traversal.requirements[0]!.evidence[0]!.path = '../report.md'
    expect(validate(traversal)).not.toEqual([])

    const missingAnchor = matrix()
    missingAnchor.requirements[0]!.evidence[0]!.anchor = 'absent-anchor'
    expect(validate(missingAnchor)).not.toEqual([])

    const missingRecovery = matrix()
    delete missingRecovery.requirements[2]!.checkpointOrMissingArtifact
    expect(validate(missingRecovery)).not.toEqual([])

    const inflated = matrix()
    inflated.requirements[2]!.status = 'verified'
    expect(validate(inflated)).not.toEqual([])

    const markdown = renderRequirementEvidenceMatrixMarkdown(matrix())
    expect(validate(matrix(), { renderedMarkdown: `${markdown}drift\n`, final: true })).not.toEqual([])
  })

  it('rejects missing, duplicate, unknown, stale, or mismatched Phase 13 source rows', () => {
    const missing = reports.phase13.replace('| DATA-06 | FAILED/CHECKPOINT | canonical_viewer_unavailable |\n', '')
    expect(validate(matrix(), { canonicalReports: { ...reports, phase13: missing } })).toContain('Canonical Phase 13 requirement DATA-06 is missing.')

    const duplicate = `${reports.phase13}\n| DATA-06 | FAILED/CHECKPOINT | duplicate |`
    expect(validate(matrix(), { canonicalReports: { ...reports, phase13: duplicate } })).toContain('Canonical Phase 13 requirement DATA-06 is duplicated.')

    const unknown = `${reports.phase13}\n| DATA-08 | SATISFIED | unknown row |`
    expect(validate(matrix(), { canonicalReports: { ...reports, phase13: unknown } })).toContain('Canonical Phase 13 requirement DATA-08 is unknown.')

    const stale = matrix()
    stale.requirements[1]!.sourceRawStatus = 'BLOCKED' as never
    expect(validate(stale)).not.toEqual([])

    const mismatched = matrix()
    mismatched.requirements[1]!.status = 'blocked'
    expect(validate(mismatched)).not.toEqual([])

    const staleAnchor = matrix()
    staleAnchor.requirements[1]!.evidence[0]!.anchor = '| DATA-01 | BLOCKED |'
    expect(validate(staleAnchor)).toContain('Requirement DATA-01 evidence must anchor the current Phase 13 raw status.')

    const staleNarrative = matrix()
    staleNarrative.requirements[2]!.checkpointOrMissingArtifact = 'fresh local/production artifact pair is missing'
    staleNarrative.requirements[2]!.recoveryPrerequisite = 'a released local runtime and a fresh evidence pair'
    expect(validate(staleNarrative)).toContain('Requirement DATA-07 must retain the terminal Viewer recovery narrative.')
  })

  it('validates fixed local matrix paths through an injected read-only CLI dependency', async () => {
    const value = matrix()
    const paths = {
      requirements: 'requirements.md',
      phase11: 'phase11.md',
      phase12: 'phase12.md',
      phase13: 'phase13.md',
      matrix: 'matrix.json',
      markdown: 'matrix.md',
    }
    const files = new Map<string, string>([
      [paths.requirements, orderedIds.map(id => `- [x] **${id}**: fixture`).join('\n')],
      [paths.phase11, reports.phase11],
      [paths.phase12, reports.phase12],
      [paths.phase13, reports.phase13],
      [paths.matrix, `${JSON.stringify(value)}\n`],
      [paths.markdown, renderRequirementEvidenceMatrixMarkdown(value)],
      ['evidence/report.md', value.requirements.map(row => expectedEvidenceAnchor(row.id)).join('\n')],
    ])

    const { verifyV12EvidenceMatrix } = await loadMatrixCli()
    expect(verifyV12EvidenceMatrix({ final: true, paths, readFile: path => files.get(path) })).toEqual({ issues: [] })
  })
})

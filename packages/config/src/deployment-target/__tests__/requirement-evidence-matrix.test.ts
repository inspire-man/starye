import type { RequirementEvidenceMatrix, RequirementEvidenceStatus } from '../requirement-evidence-matrix'
import { describe, expect, it } from 'vitest'

import { verifyV12EvidenceMatrix } from '../../../../../scripts/verify-v12-evidence-matrix'
import {
  renderRequirementEvidenceMatrixMarkdown,
  validateRequirementEvidenceMatrix,
} from '../requirement-evidence-matrix'

const orderedIds = ['PROF-01', 'DATA-01', 'DATA-07', 'TEST-05', 'TEST-07']
const reports = {
  phase11: '## Requirements Coverage\n| PROF-01 | VERIFIED | profile evidence |',
  phase12: '## Requirement Coverage\n| ENV-03 | VERIFIED | runtime evidence |',
  phase13: [
    '### Requirements Coverage',
    '| DATA-01 | BLOCKED | missing local pair |',
    '| DATA-02 | BLOCKED | missing D1 readiness |',
    '| DATA-03 | BLOCKED | missing fixture run |',
    '| DATA-04 | BLOCKED | missing provider tuple |',
    '| DATA-05 | BLOCKED | missing dashboard receipt |',
    '| DATA-06 | BLOCKED | missing viewer receipt |',
    '| DATA-07 | PARTIAL | checkpoint artifacts only |',
    '| TEST-05 | PARTIAL | live output missing |',
  ].join('\n'),
}

function matrix(ids = orderedIds): RequirementEvidenceMatrix {
  return {
    version: 1,
    requirements: ids.map(id => ({
      id,
      sourcePhase: id.startsWith('DATA') || id === 'TEST-05' ? 13 : id === 'TEST-07' ? 14 : 11,
      status: (id === 'DATA-07' || id === 'TEST-05' ? 'partial' : id === 'DATA-01' ? 'blocked' : 'verified') as RequirementEvidenceStatus,
      evidence: [{ kind: 'verification', path: 'evidence/report.md', anchor: `anchor-${id}` }],
      limitations: ['local static evidence only'],
      ...(id === 'DATA-01' || id === 'DATA-07' || id === 'TEST-05'
        ? {
            checkpointOrMissingArtifact: 'fresh local/production artifact pair is missing',
            recoveryPrerequisite: 'a released local runtime and a fresh evidence pair',
            nextOperatorCommand: '$gsd-plan-phase 13 --gaps',
          }
        : {}),
    })),
  }
}

function validate(input: unknown, overrides: Record<string, unknown> = {}) {
  const value = input as ReturnType<typeof matrix>
  return validateRequirementEvidenceMatrix(value, {
    requirementIds: orderedIds,
    canonicalReports: reports,
    readFile: path => path === 'evidence/report.md'
      ? orderedIds.map(id => `anchor-${id}`).join('\n')
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
    delete missingRecovery.requirements[1]!.checkpointOrMissingArtifact
    expect(validate(missingRecovery)).not.toEqual([])

    const inflated = matrix()
    inflated.requirements[1]!.status = 'verified'
    expect(validate(inflated)).not.toEqual([])

    const markdown = renderRequirementEvidenceMatrixMarkdown(matrix())
    expect(validate(matrix(), { renderedMarkdown: `${markdown}drift\n`, final: true })).not.toEqual([])
  })

  it('validates fixed local matrix paths through an injected read-only CLI dependency', () => {
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
      ['evidence/report.md', orderedIds.map(id => `anchor-${id}`).join('\n')],
    ])

    expect(verifyV12EvidenceMatrix({ final: true, paths, readFile: path => files.get(path) })).toEqual({ issues: [] })
  })
})

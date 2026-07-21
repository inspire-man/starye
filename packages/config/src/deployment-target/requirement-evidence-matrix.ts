export const requirementEvidenceStatusValues = ['verified', 'partial', 'blocked', 'deferred'] as const

export type RequirementEvidenceStatus = (typeof requirementEvidenceStatusValues)[number]

export interface RequirementEvidenceReference {
  kind: string
  path: string
  anchor: string
}

export interface RequirementEvidenceRow {
  id: string
  sourcePhase: number
  status: RequirementEvidenceStatus
  evidence: RequirementEvidenceReference[]
  limitations: string[]
  checkpointOrMissingArtifact?: string
  recoveryPrerequisite?: string
  nextOperatorCommand?: string
}

export interface RequirementEvidenceMatrix {
  version: 1
  requirements: RequirementEvidenceRow[]
}

export interface RequirementEvidenceMatrixValidationOptions {
  requirementIds: readonly string[]
  canonicalReports: { phase11: string, phase12: string, phase13: string }
  readFile: (path: string) => string | undefined
  renderedMarkdown?: string
  final?: boolean
}

const phase13RequirementIds = new Set([
  'DATA-01',
  'DATA-02',
  'DATA-03',
  'DATA-04',
  'DATA-05',
  'DATA-06',
  'DATA-07',
  'TEST-05',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isLocalEvidencePath(path: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:|[\\/])/i.test(path)
    && !path.split(/[\\/]/).includes('..')
}

function canonicalPhase13Statuses(report: string): Map<string, RequirementEvidenceStatus> {
  const statuses = new Map<string, RequirementEvidenceStatus>()
  if (!report.includes('Requirements Coverage')) {
    return statuses
  }

  for (const id of phase13RequirementIds) {
    const match = report.match(new RegExp(`\\|\\s*${id}\\s*\\|\\s*(BLOCKED|PARTIAL)\\s*\\|`, 'i'))
    if (match) {
      statuses.set(id, match[1]!.toLowerCase() as RequirementEvidenceStatus)
    }
  }
  return statuses
}

export function parseV12RequirementIds(requirementsText: string): string[] {
  const activeSection = requirementsText.split(/^## Future Requirements$/m)[0] ?? requirementsText
  return [...activeSection.matchAll(/^- \[[ xX]\] \*\*([A-Z]+-\d{2})\*\*:/gm)].map(match => match[1]!)
}

export function renderRequirementEvidenceMatrixMarkdown(matrix: RequirementEvidenceMatrix): string {
  const lines = [
    '# v1.2 Requirement Evidence Matrix',
    '',
    '| Requirement | Source phase | Status | Evidence | Limitations |',
    '| --- | --- | --- | --- | --- |',
    ...matrix.requirements.map((row) => {
      const evidence = row.evidence.map(item => `${item.kind}: [${item.path}#${item.anchor}](${item.path})`).join('<br>')
      const recovery = row.status === 'verified'
        ? ''
        : `<br>Checkpoint: ${row.checkpointOrMissingArtifact}<br>Prerequisite: ${row.recoveryPrerequisite}<br>Next: ${row.nextOperatorCommand}`
      return `| ${row.id} | ${row.sourcePhase} | ${row.status} | ${evidence} | ${row.limitations.join('; ')}${recovery} |`
    }),
    '',
  ]

  return lines.join('\n')
}

export function validateRequirementEvidenceMatrix(
  input: unknown,
  options: RequirementEvidenceMatrixValidationOptions,
): string[] {
  const issues: string[] = []
  if (!isRecord(input) || input.version !== 1 || !Array.isArray(input.requirements)) {
    return ['Matrix must be an object with version 1 and a requirements array.']
  }

  const rows = input.requirements
  if (rows.length !== options.requirementIds.length || rows.length === 0) {
    issues.push(`Matrix must contain exactly ${options.requirementIds.length} requirement rows.`)
  }

  const phase13Statuses = canonicalPhase13Statuses(options.canonicalReports.phase13)
  if (phase13Statuses.size !== phase13RequirementIds.size) {
    issues.push('Canonical Phase 13 Requirements Coverage is incomplete.')
  }
  if (!options.canonicalReports.phase11.includes('Requirements Coverage') || !options.canonicalReports.phase12.includes('Requirement Coverage')) {
    issues.push('Canonical Phase 11/12 requirement coverage is missing.')
  }

  const seen = new Set<string>()
  for (const [index, unknownRow] of rows.entries()) {
    if (!isRecord(unknownRow)) {
      issues.push(`Requirement row ${index + 1} must be an object.`)
      continue
    }

    const id = unknownRow.id
    if (!hasText(id)) {
      issues.push(`Requirement row ${index + 1} has an empty id.`)
      continue
    }
    if (seen.has(id)) {
      issues.push(`Requirement ${id} is duplicated.`)
    }
    seen.add(id)
    if (id !== options.requirementIds[index]) {
      issues.push(`Requirement ${id} is not in canonical order at row ${index + 1}.`)
    }
    if (!requirementEvidenceStatusValues.includes(unknownRow.status as RequirementEvidenceStatus)) {
      issues.push(`Requirement ${id} has an invalid status.`)
    }
    if (typeof unknownRow.sourcePhase !== 'number') {
      issues.push(`Requirement ${id} must declare a numeric source phase.`)
    }
    if (!Array.isArray(unknownRow.limitations) || unknownRow.limitations.length === 0 || !unknownRow.limitations.every(hasText)) {
      issues.push(`Requirement ${id} must declare non-empty limitations.`)
    }

    if (!Array.isArray(unknownRow.evidence) || unknownRow.evidence.length === 0) {
      issues.push(`Requirement ${id} must declare local evidence.`)
    }
    else {
      for (const reference of unknownRow.evidence) {
        if (!isRecord(reference) || !hasText(reference.kind) || !hasText(reference.path) || !hasText(reference.anchor)) {
          issues.push(`Requirement ${id} has an incomplete evidence reference.`)
          continue
        }
        if (!isLocalEvidencePath(reference.path)) {
          issues.push(`Requirement ${id} evidence path is not repository-relative and local.`)
          continue
        }
        const contents = options.readFile(reference.path)
        if (contents === undefined) {
          issues.push(`Requirement ${id} evidence path is missing: ${reference.path}.`)
        }
        else if (!contents.includes(reference.anchor)) {
          issues.push(`Requirement ${id} evidence anchor is absent: ${reference.path}#${reference.anchor}.`)
        }
      }
    }

    const status = unknownRow.status as RequirementEvidenceStatus
    if (status === 'partial' || status === 'blocked' || status === 'deferred') {
      for (const key of ['checkpointOrMissingArtifact', 'recoveryPrerequisite', 'nextOperatorCommand'] as const) {
        if (!hasText(unknownRow[key])) {
          issues.push(`Requirement ${id} with ${status} status requires ${key}.`)
        }
      }
    }

    const canonicalStatus = phase13Statuses.get(id)
    if (canonicalStatus && status !== canonicalStatus) {
      issues.push(`Requirement ${id} status must remain ${canonicalStatus} per Phase 13 verification.`)
    }
    if (options.final && unknownRow.sourcePhase === 14 && id.startsWith('TEST-') && status !== 'verified') {
      issues.push(`Final matrix requires Phase 14 ${id} to be verified.`)
    }
  }

  for (const id of options.requirementIds) {
    if (!seen.has(id)) {
      issues.push(`Matrix is missing requirement ${id}.`)
    }
  }
  for (const id of seen) {
    if (!options.requirementIds.includes(id)) {
      issues.push(`Matrix contains unknown requirement ${id}.`)
    }
  }

  if (options.renderedMarkdown !== undefined && isRecord(input) && Array.isArray(input.requirements)) {
    const rendered = renderRequirementEvidenceMatrixMarkdown(input as unknown as RequirementEvidenceMatrix)
    if (options.renderedMarkdown !== rendered) {
      issues.push('Derived Markdown does not match canonical JSON rendering.')
    }
  }

  return issues
}

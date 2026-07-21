import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  parseV12RequirementIds,
  validateRequirementEvidenceMatrix,
} from '../packages/config/src/deployment-target/requirement-evidence-matrix'

export interface EvidenceMatrixPaths {
  requirements: string
  phase11: string
  phase12: string
  phase13: string
  matrix: string
  markdown: string
}

export interface VerifyV12EvidenceMatrixOptions {
  final?: boolean
  paths?: EvidenceMatrixPaths
  readFile?: (path: string) => string | undefined
}

export const defaultEvidenceMatrixPaths: EvidenceMatrixPaths = {
  requirements: '.planning/REQUIREMENTS.md',
  phase11: '.planning/phases/11-deployment-target-foundation/11-VERIFICATION.md',
  phase12: '.planning/phases/12-cloudflare-config-switching/12-VERIFICATION.md',
  phase13: '.planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md',
  matrix: '.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.json',
  markdown: '.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.md',
}

const repositoryRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))

function readLocalFile(relativePath: string): string | undefined {
  const candidate = path.resolve(repositoryRoot, relativePath)
  if (candidate !== repositoryRoot && !candidate.startsWith(`${repositoryRoot}${path.sep}`)) {
    return undefined
  }
  try {
    return readFileSync(candidate, 'utf8')
  }
  catch {
    return undefined
  }
}

export function verifyV12EvidenceMatrix(options: VerifyV12EvidenceMatrixOptions = {}): { issues: string[] } {
  const paths = options.paths ?? defaultEvidenceMatrixPaths
  const read = options.readFile ?? readLocalFile
  const requirements = read(paths.requirements)
  const phase11 = read(paths.phase11)
  const phase12 = read(paths.phase12)
  const phase13 = read(paths.phase13)
  const matrixText = read(paths.matrix)
  const markdown = read(paths.markdown)
  if (!requirements || !phase11 || !phase12 || !phase13 || !matrixText || markdown === undefined) {
    return { issues: ['Matrix validation inputs are missing.'] }
  }

  let matrix: unknown
  try {
    matrix = JSON.parse(matrixText)
  }
  catch {
    return { issues: ['Canonical matrix JSON is invalid.'] }
  }

  return {
    issues: validateRequirementEvidenceMatrix(matrix, {
      requirementIds: parseV12RequirementIds(requirements),
      canonicalReports: { phase11, phase12, phase13 },
      readFile: read,
      renderedMarkdown: markdown,
      final: options.final === true,
    }),
  }
}

export function runVerifyV12EvidenceMatrixCli(argv: readonly string[] = process.argv.slice(2)): number {
  if (argv.some(argument => argument !== '--final')) {
    process.stderr.write('verify-v12-evidence-matrix accepts only --final.\n')
    return 1
  }

  const result = verifyV12EvidenceMatrix({ final: argv.includes('--final') })
  process.stdout.write(`${JSON.stringify({ valid: result.issues.length === 0, issues: result.issues })}\n`)
  return result.issues.length === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runVerifyV12EvidenceMatrixCli()
}

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repositoryRoot = process.cwd()

function sourceFiles(directory) {
  if (!fs.existsSync(directory))
    return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory())
      return sourceFiles(target)
    return /\.(?:ts|vue|js|mjs)$/u.test(entry.name) ? [target] : []
  })
}

function importsFrom(file) {
  const source = fs.readFileSync(file, 'utf8')
  return [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)].map(match => match[1])
}

const rules = [
  {
    name: 'Quant components do not reach transport modules',
    directory: path.join(repositoryRoot, 'apps/quant-app/src/components'),
    forbidden: value => value.startsWith('../api/') || value.startsWith('../../api/'),
  },
  {
    name: 'Quant stores do not reach UI modules',
    directory: path.join(repositoryRoot, 'apps/quant-app/src/stores'),
    forbidden: value => value.includes('/components/') || value.includes('/views/'),
  },
  {
    name: 'Quant API transport does not reach UI or store modules',
    directory: path.join(repositoryRoot, 'apps/quant-app/src/api'),
    forbidden: value => value.includes('/components/') || value.includes('/stores/'),
  },
  {
    name: 'Quant shared logic does not reach feature, store or transport modules',
    directory: path.join(repositoryRoot, 'apps/quant-app/src/lib'),
    ignore: new Set(['api-client.ts']),
    forbidden: value => value.includes('/components/') || value.includes('/stores/') || value.startsWith('../api/'),
  },
  {
    name: 'Quant workspace route delegates D1 and sync orchestration',
    directory: path.join(repositoryRoot, 'apps/api/src/routes/quant/handlers'),
    files: new Set(['workspace.handler.ts']),
    forbidden: value => value.includes('/domain/quant/repository') || value.includes('/domain/quant/sync'),
  },
]

const violations = []

const styleEntry = path.join(repositoryRoot, 'apps/quant-app/src/style.css')
const styleImports = fs.readFileSync(styleEntry, 'utf8')
  .split(/\r?\n/u)
  .map(line => line.trim())
  .filter(Boolean)
if (!styleImports.every(line => line.startsWith('@import ')))
  violations.push('Quant style entry must contain imports only.')

const requiredStyleLayers = [
  'quant-base.css',
  'quant-overview.css',
  'quant-watchlist.css',
  'quant-candidates.css',
  'quant-detail.css',
  'quant-comparison.css',
  'quant-knowledge.css',
  'quant-responsive.css',
]
for (const filename of requiredStyleLayers) {
  if (!fs.existsSync(path.join(repositoryRoot, 'apps/quant-app/src/styles', filename)))
    violations.push(`Quant style layer is missing: ${filename}`)
}

for (const rule of rules) {
  for (const file of sourceFiles(rule.directory)) {
    if (rule.files && !rule.files.has(path.basename(file)))
      continue
    if (rule.ignore?.has(path.basename(file)))
      continue
    for (const imported of importsFrom(file)) {
      if (rule.forbidden(imported))
        violations.push(`${rule.name}: ${path.relative(repositoryRoot, file)} -> ${imported}`)
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'))
  process.exitCode = 1
}
else {
  console.log('Quant dependency boundaries passed.')
}

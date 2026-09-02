import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const docsRoot = path.join(projectRoot, 'docs')
const frameworksRoot = path.join(docsRoot, 'references', 'frameworks')
const generatedRoot = path.join(docsRoot, 'generated')
const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs-sources.json'), 'utf8'))
const errors = []

function addError(message) {
  errors.push(message)
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  }
  catch (error) {
    addError(`${label}: ${error.message}`)
    return null
  }
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function normalizePath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, '/')
}

function shouldSkip(relativePath) {
  const normalized = relativePath.replaceAll(path.sep, '/')
  return normalized.includes('/node_modules/')
    || normalized.includes('/dist/')
    || normalized.includes('/coverage/')
    || normalized.startsWith('docs/archive/')
    || normalized.startsWith('docs/references/')
    || normalized.startsWith('docs/generated/')
    || normalized.startsWith('packages/crawler/examples/')
}

function collectMarkdownFiles(rootPath, files = new Set()) {
  if (!fs.existsSync(rootPath))
    return files

  const stat = fs.statSync(rootPath)
  if (stat.isFile()) {
    if (rootPath.endsWith('.md') || rootPath.endsWith('.mdx'))
      files.add(rootPath)
    return files
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name)
    if (shouldSkip(normalizePath(entryPath)))
      continue
    if (entry.isDirectory())
      collectMarkdownFiles(entryPath, files)
    else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')))
      files.add(entryPath)
  }

  return files
}

function checkLocalMarkdownLinks() {
  const roots = [
    'AGENTS.md',
    'ARCHITECTURE.md',
    'CLAUDE.md',
    'README.md',
    'RUNBOOK.md',
    'docs',
    'apps/api',
    'apps/blog',
    'apps/comic-app',
    'apps/dashboard',
    'apps/movie-app',
    'apps/auth',
    'apps/quant-app',
    'packages/config',
    'packages/crawler',
    'packages/db',
    'packages/ui',
    'scripts',
  ]
  const files = new Set()
  for (const root of roots)
    collectMarkdownFiles(path.join(projectRoot, root), files)

  const linkPattern = /\]\(([^)]+)\)/g
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8')
    let match = linkPattern.exec(content)
    while (match !== null) {
      let target = match[1].trim()
      if (target.startsWith('<') && target.includes('>'))
        target = target.slice(1, target.indexOf('>'))
      target = target.split(/[\s#]/, 1)[0]
      if (target && !/^(?:https?:|mailto:|data:|javascript:)/i.test(target)) {
        const targetPath = path.resolve(path.dirname(filePath), decodeURIComponent(target))
        if (!fs.existsSync(targetPath))
          addError(`${normalizePath(filePath)} -> ${target}`)
      }
      match = linkPattern.exec(content)
    }
  }
}

function checkFrameworks(meta, sections) {
  const ids = sources.map(source => source.id)
  if (new Set(ids).size !== ids.length)
    addError('scripts/docs-sources.json contains duplicate IDs')
  if (new Set(sources.map(source => source.url)).size !== sources.length)
    addError('scripts/docs-sources.json contains duplicate URLs')

  for (const source of sources) {
    const sourceDir = path.join(frameworksRoot, source.id)
    const documentPath = path.join(sourceDir, source.filename)
    const versionPath = path.join(sourceDir, '.version')
    if (!fs.existsSync(documentPath))
      addError(`${normalizePath(documentPath)} is missing`)
    if (!fs.existsSync(versionPath))
      addError(`${normalizePath(versionPath)} is missing`)
    if (!fs.existsSync(documentPath) || !fs.existsSync(versionPath))
      continue

    const version = readJson(versionPath, normalizePath(versionPath))
    if (!version)
      continue
    for (const field of ['source_url', 'downloaded_at', 'content_hash', 'file_size']) {
      if (version[field] === undefined || version[field] === null)
        addError(`${normalizePath(versionPath)} is missing ${field}`)
    }
    const actualHash = sha256(documentPath)
    if (version.content_hash !== actualHash)
      addError(`${normalizePath(versionPath)} content_hash does not match ${normalizePath(documentPath)}`)
    if (version.file_size !== fs.statSync(documentPath).size)
      addError(`${normalizePath(versionPath)} file_size does not match ${normalizePath(documentPath)}`)
    if (version.source_url !== source.url)
      addError(`${normalizePath(versionPath)} source_url does not match manifest`)

    const expectedPath = `docs/references/frameworks/${source.id}/${source.filename}`
    if (!meta?.[source.id] || meta[source.id].local_path !== expectedPath)
      addError(`generated/_meta.json has no correct entry for ${source.id}`)
    if (!sections?.[source.id] || sections[source.id].file !== expectedPath)
      addError(`generated/_sections.json has no correct entry for ${source.id}`)
  }

  if (meta && Object.keys(meta).sort().join('|') !== ids.slice().sort().join('|'))
    addError('generated/_meta.json entries do not match the manifest')
  if (sections && Object.keys(sections).sort().join('|') !== ids.slice().sort().join('|'))
    addError('generated/_sections.json entries do not match the manifest')
}

const meta = readJson(path.join(generatedRoot, '_meta.json'), 'generated/_meta.json')
const sections = readJson(path.join(generatedRoot, '_sections.json'), 'generated/_sections.json')
checkFrameworks(meta, sections)
checkLocalMarkdownLinks()

if (errors.length > 0) {
  console.error('Documentation integrity check failed:')
  for (const error of errors)
    console.error(`  - ${error}`)
  process.exitCode = 1
}
else {
  console.log(`Documentation integrity check passed: ${sources.length} managed references and live Markdown links are consistent.`)
}

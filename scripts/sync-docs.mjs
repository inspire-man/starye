import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { generateMeta } from './generate-meta.js'
import { generateSections } from './generate-sections.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs-sources.json'), 'utf8'))
const frameworksDir = path.join(projectRoot, 'docs', 'references', 'frameworks')
const dryRun = process.argv.includes('--dry-run')

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function readVersion(versionPath) {
  if (!fs.existsSync(versionPath))
    return null

  try {
    return JSON.parse(fs.readFileSync(versionPath, 'utf8'))
  }
  catch {
    return null
  }
}

async function syncSource(source) {
  const sourceDir = path.join(frameworksDir, source.id)
  const documentPath = path.join(sourceDir, source.filename)
  const versionPath = path.join(sourceDir, '.version')

  fs.mkdirSync(sourceDir, { recursive: true })
  console.log(`Syncing ${source.id}...`)

  const response = await fetch(source.url, {
    headers: {
      'Accept': 'text/plain',
      'User-Agent': 'starye-docs-sync/1.0',
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok)
    throw new Error(`HTTP ${response.status}`)

  const content = Buffer.from(await response.arrayBuffer())
  const contentHash = hashContent(content)
  const previousVersion = readVersion(versionPath)

  if (previousVersion?.content_hash === contentHash && fs.existsSync(documentPath)) {
    console.log(`  + ${source.id} is up to date`)
    return 'unchanged'
  }

  if (dryRun) {
    console.log(`  + ${source.id} would update (dry run)`)
    return 'changed'
  }

  const temporaryPath = `${documentPath}.tmp-${process.pid}`
  try {
    fs.writeFileSync(temporaryPath, content)
    fs.rmSync(documentPath, { force: true })
    fs.renameSync(temporaryPath, documentPath)
    const versionData = {
      source_url: source.url,
      downloaded_at: new Date().toISOString(),
      content_hash: contentHash,
      file_size: content.byteLength,
    }
    fs.writeFileSync(versionPath, `${JSON.stringify(versionData, null, 2)}\n`)
  }
  finally {
    fs.rmSync(temporaryPath, { force: true })
  }

  console.log(`  + ${source.id} updated`)
  return 'changed'
}

async function main() {
  let failed = 0

  for (const source of sources) {
    try {
      await syncSource(source)
    }
    catch (error) {
      failed += 1
      console.error(`  - Failed to download ${source.id}: ${error.message}`)
    }
  }

  console.log('Generating metadata...')
  generateMeta()
  console.log('Generating section index...')
  generateSections()
  console.log('')

  if (failed > 0)
    console.log(`Documentation sync complete with ${failed} failed source(s); existing files were preserved.`)
  else
    console.log('Documentation sync complete')
}

main().catch((error) => {
  console.error('Documentation sync failed:', error.message)
  process.exitCode = 1
})

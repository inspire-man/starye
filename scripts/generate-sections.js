import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FRAMEWORKS_DIR = path.join(__dirname, '..', 'docs', 'references', 'frameworks')
const GENERATED_DIR = path.join(__dirname, '..', 'docs', 'generated')
const DOCUMENT_FILE = 'llms.txt'

function extractKeywords(title) {
  return title
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter(word => word.length > 2)
}

function parseHeading(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('#'))
    return null

  let level = 0
  let i = 0
  while (i < trimmed.length && trimmed[i] === '#') {
    level++
    i++
  }

  if (level > 6 || i >= trimmed.length || trimmed[i] !== ' ')
    return null

  const title = trimmed.slice(i + 1).trim()
  if (!title)
    return null

  return { level, title }
}

export function extractSections(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const sections = []
    const sectionStack = []

    lines.forEach((line, index) => {
      const heading = parseHeading(line)
      if (!heading)
        return

      const { level, title } = heading
      while (sectionStack.length > 0 && sectionStack.at(-1).level >= level) {
        const closed = sectionStack.pop()
        closed.end_line = index
      }

      const section = {
        title,
        level,
        start_line: index + 1,
        end_line: -1,
        keywords: extractKeywords(title),
      }

      if (sectionStack.length === 0) {
        sections.push(section)
      }
      else {
        const parent = sectionStack.at(-1)
        if (!parent.subsections)
          parent.subsections = []
        parent.subsections.push(section)
      }

      sectionStack.push(section)
    })

    sectionStack.forEach((section) => {
      if (section.end_line === -1)
        section.end_line = lines.length
    })

    return sections
  }
  catch (err) {
    console.warn(`Warning: Failed to parse ${filePath}: ${err.message}`)
    return []
  }
}

export function generateSections() {
  const index = {}

  try {
    const entries = fs.readdirSync(FRAMEWORKS_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory())
        continue

      const libName = entry.name
      const txtPath = path.join(FRAMEWORKS_DIR, libName, DOCUMENT_FILE)
      if (!fs.existsSync(txtPath))
        continue

      console.log(`Indexing ${libName}...`)
      index[libName] = {
        file: `docs/references/frameworks/${libName}/${DOCUMENT_FILE}`,
        sections: extractSections(txtPath),
      }
    }

    fs.mkdirSync(GENERATED_DIR, { recursive: true })
    const indexPath = path.join(GENERATED_DIR, '_sections.json')
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)
    console.log('Generated docs/generated/_sections.json')
  }
  catch (err) {
    console.error('Error generating section index:', err.message)
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename)
  generateSections()

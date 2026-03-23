import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.join(__dirname, '..', 'docs')

// 提取关键词
function extractKeywords(title) {
  return title
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter(word => word.length > 2)
}

// 检查是否为 Markdown 标题行
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

// 解析文档章节
function extractSections(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    const sections = []
    const sectionStack = []

    lines.forEach((line, index) => {
      const heading = parseHeading(line)
      if (heading) {
        const { level, title } = heading

        // 关闭所有层级 >= 当前层级的章节
        while (sectionStack.length > 0 && sectionStack.at(-1).level >= level) {
          const closed = sectionStack.pop()
          closed.end_line = index
        }

        // 创建新章节
        const section = {
          title,
          level,
          start_line: index + 1,
          end_line: -1,
          keywords: extractKeywords(title),
        }

        // 确定父子关系
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
      }
    })

    // 关闭所有未关闭的章节
    sectionStack.forEach((s) => {
      if (s.end_line === -1)
        s.end_line = lines.length
    })

    return sections
  }
  catch (err) {
    console.warn(`Warning: Failed to parse ${filePath}: ${err.message}`)
    return []
  }
}

// 生成章节索引
function generateSections() {
  const index = {}

  try {
    const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory())
        continue

      const libName = entry.name
      const txtPath = path.join(DOCS_DIR, libName, 'llms-full.txt')

      if (!fs.existsSync(txtPath))
        continue

      console.log(`Indexing ${libName}...`)

      const sections = extractSections(txtPath)
      index[libName] = {
        file: `docs/${libName}/llms-full.txt`,
        sections,
      }
    }

    // 写入索引文件
    const indexPath = path.join(DOCS_DIR, '_sections.json')
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)

    console.log('Generated docs/_sections.json')
  }
  catch (err) {
    console.error('Error generating section index:', err.message)
    process.exit(1)
  }
}

generateSections()

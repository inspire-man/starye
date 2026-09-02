/* eslint-disable node/prefer-global/process */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FRAMEWORKS_DIR = path.join(__dirname, '..', 'docs', 'references', 'frameworks')
const GENERATED_DIR = path.join(__dirname, '..', 'docs', 'generated')
const DOCUMENT_FILE = 'llms.txt'

export function generateMeta() {
  const meta = {}

  try {
    const entries = fs.readdirSync(FRAMEWORKS_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory())
        continue

      const libName = entry.name
      const libPath = path.join(FRAMEWORKS_DIR, libName)
      const txtPath = path.join(libPath, DOCUMENT_FILE)
      const versionPath = path.join(libPath, '.version')

      if (!fs.existsSync(txtPath)) {
        console.warn(`Warning: ${libName} 目录缺少 ${DOCUMENT_FILE}，跳过`)
        continue
      }

      const stats = fs.statSync(txtPath)
      const fileSizeKB = (stats.size / 1024).toFixed(1)
      let lastUpdated = stats.mtime.toISOString().split('T')[0]
      let versionData = null

      if (fs.existsSync(versionPath)) {
        try {
          versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'))
          if (versionData.downloaded_at)
            lastUpdated = versionData.downloaded_at.split('T')[0]
        }
        catch {
          console.warn(`Warning: 无法解析 ${libName} 的 .version 文件`)
        }
      }

      meta[libName] = {
        local_path: `docs/references/frameworks/${libName}/${DOCUMENT_FILE}`,
        file_size: `${fileSizeKB}KB`,
        last_updated: lastUpdated,
        source_url: versionData?.source_url ?? null,
        content_hash: versionData?.content_hash ?? null,
      }
    }

    fs.mkdirSync(GENERATED_DIR, { recursive: true })
    const metaPath = path.join(GENERATED_DIR, '_meta.json')
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    console.log('Generated docs/generated/_meta.json')
  }
  catch (err) {
    console.error('Error generating metadata:', err.message)
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename)
  generateMeta()

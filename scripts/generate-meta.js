/* eslint-disable node/prefer-global/process */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.join(__dirname, '..', 'docs')

// 扫描 docs/ 目录生成元数据索引
function generateMeta() {
  const meta = {}

  try {
    const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory())
        continue

      const libName = entry.name
      const libPath = path.join(DOCS_DIR, libName)
      const txtPath = path.join(libPath, 'llms-full.txt')
      const versionPath = path.join(libPath, '.version')

      // 检查是否有完整文档
      if (!fs.existsSync(txtPath)) {
        console.warn(`Warning: ${libName} 目录缺少 llms-full.txt，跳过`)
        continue
      }

      // 读取文件大小
      const stats = fs.statSync(txtPath)
      const fileSizeKB = (stats.size / 1024).toFixed(1)

      // 读取版本信息
      let lastUpdated = stats.mtime.toISOString().split('T')[0]
      if (fs.existsSync(versionPath)) {
        try {
          const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'))
          if (versionData.downloaded_at) {
            lastUpdated = versionData.downloaded_at.split('T')[0]
          }
        }
        catch {
          console.warn(`Warning: 无法解析 ${libName} 的 .version 文件`)
        }
      }

      meta[libName] = {
        local_path: `docs/${libName}/llms-full.txt`,
        file_size: `${fileSizeKB}KB`,
        last_updated: lastUpdated,
      }
    }

    // 写入元数据文件
    const metaPath = path.join(DOCS_DIR, '_meta.json')
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)

    console.log('Generated docs/_meta.json')
  }
  catch (err) {
    console.error('Error generating metadata:', err.message)
    process.exit(1)
  }
}

generateMeta()

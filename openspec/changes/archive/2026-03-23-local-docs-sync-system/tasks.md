## 1. 创建脚本和配置文件

- [x] 1.1 创建 `scripts/sync-docs.sh` Bash 脚本，定义 9 个框架的 URL 映射
- [x] 1.2 在 `sync-docs.sh` 中实现文档下载逻辑，使用 curl 并处理网络错误
- [x] 1.3 在 `sync-docs.sh` 中实现 SHA256 哈希计算，用于检测文档变化
- [x] 1.4 在 `sync-docs.sh` 中实现 `.version` 文件生成，包含 source_url、downloaded_at、content_hash、file_size 字段
- [x] 1.5 在 `sync-docs.sh` 中实现增量更新逻辑，比对哈希值决定是否覆盖文件
- [x] 1.6 在 `sync-docs.sh` 中添加进度输出，显示 "Syncing...", "✓ updated", "✓ up to date", "✗ Failed" 等状态
- [x] 1.7 在 `sync-docs.sh` 末尾自动调用 `generate-meta.js` 和 `generate-sections.js`

## 2. 实现元数据索引生成

- [x] 2.1 创建 `scripts/generate-meta.js`，使用 Node.js fs 模块扫描 `docs/` 目录
- [x] 2.2 实现扫描逻辑，遍历所有包含 `llms-full.txt` 的子目录
- [x] 2.3 读取每个框架的 `.version` 文件，提取 downloaded_at 和 file_size 信息
- [x] 2.4 计算文件大小并格式化为 "XXX.XKB" 格式
- [x] 2.5 生成 `docs/_meta.json` 文件，包含所有框架的 local_path、file_size、last_updated 字段
- [x] 2.6 格式化 JSON 输出为 2 空格缩进，便于人类阅读
- [x] 2.7 添加错误处理，对无法读取的目录输出警告但不中断流程
- [x] 2.8 在脚本末尾输出 "Generated docs/_meta.json" 成功消息

## 3. 实现章节索引生成

- [x] 3.1 创建 `scripts/generate-sections.js`，导入必要的 Node.js 模块
- [x] 3.2 实现 Markdown 标题识别函数，使用正则表达式匹配 `^(#{1,6})\s+(.+)$`
- [x] 3.3 实现章节解析函数 `extractSections(filePath)`，扫描文档并构建章节树
- [x] 3.4 在解析函数中记录每个章节的 title、level、start_line、end_line
- [x] 3.5 实现章节层级关系维护，使用栈结构处理嵌套标题
- [x] 3.6 实现关键词提取函数 `extractKeywords(title)`，分词并过滤短词
- [x] 3.7 遍历所有框架文档，调用 `extractSections()` 生成索引数据
- [x] 3.8 生成 `docs/_sections.json` 文件，格式化为 2 空格缩进
- [x] 3.9 添加异常处理，对无法解析的文档返回空 sections 数组并输出警告
- [x] 3.10 在脚本末尾输出 "Generated docs/_sections.json" 成功消息

## 4. 更新项目配置

- [x] 4.1 在根目录 `package.json` 的 scripts 中添加 `"docs:sync": "bash scripts/sync-docs.sh"`
- [x] 4.2 在 `package.json` 的 scripts 中添加 `"docs:meta": "node scripts/generate-meta.js"`
- [x] 4.3 在 `package.json` 的 scripts 中添加 `"docs:index": "node scripts/generate-sections.js"`
- [x] 4.4 验证脚本在 package.json 中正确注册，可通过 `pnpm run` 查看

## 5. 更新 .cursorrules 配置

- [x] 5.1 在 `.cursorrules` 中添加 "## 文档参考策略" 章节
- [x] 5.2 创建技术栈到文档路径的映射表，包含所有 9 个框架
- [x] 5.3 定义三层查找策略：快速路径（章节索引）、降级路径（Grep）、兜底路径（WebSearch）
- [x] 5.4 添加快速路径示例，演示如何读取 `_sections.json` 并使用 Read 工具的 offset/limit
- [x] 5.5 添加降级路径示例，演示如何使用 Grep 搜索关键词
- [x] 5.6 添加大文件处理指引，说明对标记 `size_warning` 的文档必须使用章节索引
- [x] 5.7 添加文档更新说明，告知 AI 可通过 `_meta.json` 的 last_updated 判断文档新旧
- [x] 5.8 添加同步命令说明，告知开发者运行 `pnpm docs:sync` 更新文档

## 6. 首次同步和验证

- [x] 6.1 确保系统已安装 Git Bash 或类 Unix shell（Windows 用户）
- [x] 6.2 赋予 `sync-docs.sh` 执行权限：`chmod +x scripts/sync-docs.sh`（类 Unix 系统）
- [x] 6.3 运行 `pnpm docs:sync`，观察是否成功下载所有 9 个框架的文档
- [x] 6.4 验证 `docs/` 目录结构正确，每个框架子目录包含 `llms-full.txt` 和 `.version`
- [x] 6.5 验证 `docs/_meta.json` 文件生成且包含所有 9 个框架的元数据
- [x] 6.6 验证 `docs/_sections.json` 文件生成且包含章节索引数据
- [x] 6.7 手动测试增量更新：再次运行 `pnpm docs:sync`，确认显示 "up to date" 消息
- [x] 6.8 手动测试错误处理：临时修改某个 URL 为无效地址，确认脚本显示错误但不中断

## 7. 清理旧文件

- [x] 7.1 备份现有的 `docs/*-reference.md` 文件到临时目录（可选）
- [x] 7.2 删除 `docs/hono-reference.md`
- [x] 7.3 删除 `docs/better-auth-reference.md`
- [x] 7.4 删除 `docs/nuxt-reference.md`
- [x] 7.5 删除 `docs/zod-reference.md`
- [x] 7.6 删除 `docs/vite.reference.md`
- [x] 7.7 删除 `docs/vitest-reference.md`
- [x] 7.8 删除 `docs/vue.-reference.md`
- [x] 7.9 删除 `docs/turborepo-reference.md`

## 8. 测试 AI 文档查询

- [x] 8.1 测试快速路径：询问 AI "Hono 如何配置 CORS？"，验证 AI 是否使用章节索引
- [x] 8.2 测试降级路径：询问一个不常见的技术问题，验证 AI 是否使用 Grep 搜索
- [x] 8.3 测试兜底路径：询问未覆盖的技术栈（如 Tailwind CSS），验证 AI 是否使用 WebSearch
- [x] 8.4 测试多技术栈查询：询问 "如何在 Hono 中使用 Zod 验证？"，验证 AI 是否查阅两个框架文档
- [x] 8.5 测试大文件处理：询问 Better Auth 相关问题，验证 AI 是否使用章节索引而非全文读取
- [x] 8.6 测试响应时间：确认 AI 查询本地文档的响应时间在 1-3 秒内

## 9. 文档和提交

- [x] 9.1 在项目 README 中添加文档同步说明（可选）
- [x] 9.2 在 `.gitignore` 中添加 `docs/*/.version`（可选，如果不想提交版本文件）
- [ ] 9.3 提交所有脚本文件：`scripts/sync-docs.sh`, `generate-meta.js`, `generate-sections.js`
- [ ] 9.4 提交配置文件更改：`package.json`, `.cursorrules`
- [x] 9.5 提交新生成的文档和索引文件（或将其添加到 .gitignore）
- [ ] 9.6 创建 PR 并在描述中说明变更内容和验证结果

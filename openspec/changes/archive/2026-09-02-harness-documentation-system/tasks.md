## 1. 建立文档地图

- [x] 1.1 创建 ARCHITECTURE.md 和 docs/ 导航入口，并验证所有入口链接到当前 canonical owner
- [x] 1.2 建立 design-docs、product-specs、exec-plans、guides、references、generated 和 archive 的边界说明，并验证重复 owner 未被引入
- [x] 1.3 将稳定专题、历史报告和根目录早期文档迁移到对应目录，并验证 live 文档引用不再指向旧路径

## 2. 统一外部参考同步

- [x] 2.1 创建 scripts/docs-sources.json，覆盖当前托管的 11 个项目依赖文档，并验证 ID 唯一、URL 唯一
- [x] 2.2 将框架资料迁移到 docs/references/frameworks/<id>/llms.txt，将未托管资料放入 references/unmanaged，并验证目录职责
- [x] 2.3 实现跨平台 Node 同步入口、增量 SHA256、.version 和失败保留旧文件行为，并验证 pnpm docs:sync 可运行
- [x] 2.4 更新 generate-meta.js 和 generate-sections.js 的输入输出路径，并验证 generated JSON 含有非空条目

## 3. 建立 Harness 检查

- [x] 3.1 实现 scripts/check-docs.mjs，验证路径、版本哈希、生成索引和 live Markdown 本地链接
- [x] 3.2 将 pnpm docs:check 接入 package.json 和 .github/workflows/ci.yml，并验证命令失败时返回非零
- [x] 3.3 更新 .cursorrules、README 和归属文档中的查找路径，并验证旧路径引用只存在于历史记录或外部原文

## 4. 规格和验收

- [x] 4.1 为 docs-sync、docs-indexing、ai-docs-strategy 和 documentation-integrity 写入 change delta，并验证 OpenSpec strict
- [x] 4.2 运行 docs:meta、docs:index、docs:check、定向 lint 和 JSON readback，并记录结果
- [x] 4.3 运行 GitNexus detect_changes；完成标准：变更只覆盖文档、脚本和 CI 相关范围，未引入业务执行流变化

## Purpose

定义托管官方 llms.txt 资料的来源清单、跨平台同步、增量更新、失败保留、版本记录和可重复校验行为。

## Requirements

### Requirement: 系统能够从官方源下载 llms.txt 文档

系统 SHALL 从 scripts/docs-sources.json 定义的官方 URL 下载文档到 docs/references/frameworks/{framework}/llms.txt。同步 SHALL 使用 SHA256 进行增量判断；下载失败时保留已有文件和版本记录，并继续处理其他来源。

#### Scenario: 首次下载文档

- **WHEN** 运行 pnpm docs:sync 且本地不存在某个托管资料
- **THEN** 系统下载到 docs/references/frameworks/{framework}/llms.txt
- **AND** 系统创建包含 source_url、downloaded_at、content_hash、file_size 的 .version

#### Scenario: 文档已存在且未变化

- **WHEN** 新下载内容的 SHA256 与 .version 的 content_hash 相同
- **THEN** 系统显示该资料为 up to date
- **AND** 系统不替换正文或更新时间

#### Scenario: 文档已存在但有更新

- **WHEN** 新下载内容的 SHA256 与 .version 的 content_hash 不同
- **THEN** 系统替换 docs/references/frameworks/{framework}/llms.txt
- **AND** 系统写入新的 .version

#### Scenario: 官方 URL 失效

- **WHEN** 某个 URL 返回非成功状态或网络错误
- **THEN** 系统标记该资料失败并保留已有文件
- **AND** 系统继续同步其他资料，随后仍尝试生成索引

### Requirement: 系统能够计算文档内容哈希用于版本跟踪

系统 SHALL 使用 SHA256 算法计算托管文档内容的哈希，并将结果写入对应 references/frameworks/{framework}/.version 的 content_hash 字段。

#### Scenario: 计算新下载文档的哈希

- **WHEN** 系统成功下载一个文档文件
- **THEN** 系统计算文件的 SHA256 哈希值
- **AND** 系统将哈希值存储在 .version 的 content_hash 字段

#### Scenario: 比对哈希判断是否需要更新

- **WHEN** 系统准备下载文档且本地已有 .version 文件
- **THEN** 系统读取旧的 content_hash 值并与新内容哈希比较
- **AND** 系统据此决定是否替换文件

### Requirement: 系统必须支持以下 9 个技术栈的文档同步

系统 MUST 通过共享来源清单支持 Hono、Better Auth、Nuxt、Zod、Vite、Vitest、Vue、Turborepo、Drizzle ORM、Scalar 和 Valibot。未纳入清单的资料 MUST 放入 references/unmanaged，不得伪装成托管版本。

#### Scenario: 验证所有预配置框架可同步

- **WHEN** 运行 pnpm docs:sync 且所有清单 URL 可访问
- **THEN** 系统为 11 个托管技术栈生成 references/frameworks/{framework}/llms.txt 和 .version
- **AND** 系统生成对应的元数据和章节索引

#### Scenario: 部分框架 URL 失效时的容错

- **WHEN** 运行 pnpm docs:sync 但某个清单 URL 无法访问
- **THEN** 系统继续处理其他框架
- **AND** 系统保留失败框架的现有文件并报告失败来源
- **AND** 同步过程不因单个来源失败而中断

### Requirement: .version 文件格式规范

系统 SHALL 为每个托管文档目录生成 JSON 格式的 .version 文件，包含 source_url、downloaded_at、content_hash 和 file_size。

#### Scenario: 生成标准 .version 文件

- **WHEN** 系统下载或更新一个托管文档
- **THEN** 系统创建包含 4 个必需字段的 .version
- **AND** downloaded_at 使用 UTC ISO 8601 格式，JSON 使用 2 空格缩进

#### Scenario: .version 文件可被后续流程读取

- **WHEN** generate-meta.js 或 check-docs.mjs 读取版本信息
- **THEN** 系统能够解析有效 JSON
- **AND** 字段类型符合 string 或 number 约束

### Requirement: 同步脚本必须输出清晰的进度信息

系统 SHALL 在同步过程中输出易于理解的进度和结果信息。

#### Scenario: 同步开始时显示提示
- **WHEN** 运行 `pnpm docs:sync`
- **THEN** 系统显示 "Syncing {framework}..." 消息表示开始处理某个框架

#### Scenario: 同步成功时显示结果
- **WHEN** 某个框架的文档同步完成
- **THEN** 系统显示带有状态图标的消息（如 "✓ hono updated" 或 "✓ nuxt is up to date"）

#### Scenario: 同步失败时显示错误
- **WHEN** 某个框架的文档下载失败
- **THEN** 系统显示 "✗ Failed to download {framework}" 错误消息
- **AND** 系统显示建议操作（如 "→ Please check if the URL is still valid"）

#### Scenario: 所有框架处理完成后显示汇总
- **WHEN** 所有框架的同步尝试完成
- **THEN** 系统显示 "Generating metadata..." 和 "Generating section index..." 进度消息
- **AND** 系统显示最终的 "✓ Documentation sync complete" 成功消息

## ADDED Requirements

### Requirement: 系统能够从官方源下载 llms.txt 文档

系统 SHALL 支持从预定义的框架官方 URL 列表下载 llms.txt 格式的文档到本地 `docs/{framework}/` 目录。

#### Scenario: 首次下载文档
- **WHEN** 运行 `pnpm docs:sync` 且本地不存在该框架文档
- **THEN** 系统从官方 URL 下载文档到 `docs/{framework}/llms-full.txt`
- **AND** 系统创建 `.version` 文件记录下载时间、URL、内容哈希和文件大小

#### Scenario: 文档已存在且未变化
- **WHEN** 运行 `pnpm docs:sync` 且本地文档的内容哈希与新下载内容相同
- **THEN** 系统跳过下载并显示 "✓ {framework} is up to date" 消息
- **AND** 系统不修改现有文档和 `.version` 文件

#### Scenario: 文档已存在但有更新
- **WHEN** 运行 `pnpm docs:sync` 且本地文档的内容哈希与新下载内容不同
- **THEN** 系统用新内容覆盖旧文档
- **AND** 系统更新 `.version` 文件记录新的下载时间和内容哈希
- **AND** 系统显示 "✓ {framework} updated" 消息

#### Scenario: 官方 URL 失效
- **WHEN** 运行 `pnpm docs:sync` 但无法访问官方 URL（404 或网络错误）
- **THEN** 系统显示 "✗ Failed to download {framework}" 错误消息
- **AND** 系统保留现有文档不删除（如果存在）
- **AND** 系统继续处理其他框架的下载

### Requirement: 系统能够计算文档内容哈希用于版本跟踪

系统 SHALL 使用 SHA256 算法计算下载文档的内容哈希，用于检测文档是否有更新。

#### Scenario: 计算新下载文档的哈希
- **WHEN** 系统成功下载一个文档文件
- **THEN** 系统计算文件的 SHA256 哈希值
- **AND** 系统将哈希值存储在 `.version` 文件的 `content_hash` 字段

#### Scenario: 比对哈希判断是否需要更新
- **WHEN** 系统准备下载文档且本地已有 `.version` 文件
- **THEN** 系统读取旧的 `content_hash` 值
- **AND** 系统计算新下载内容的哈希值
- **AND** 系统比对两个哈希值以决定是否更新文件

### Requirement: 系统必须支持以下 9 个技术栈的文档同步

系统 MUST 预配置以下框架的 llms.txt 文档源 URL：

- Hono: `https://hono.dev/llms-full.txt`
- Better Auth: `https://better-auth.com/llms.txt`
- Nuxt: `https://nuxt.com/llms-full.txt`
- Zod: `https://zod.dev/llms.txt`
- Vite: `https://vite.dev/llms.txt`
- Vitest: `https://vitest.dev/llms.txt`
- Vue: `https://vuejs.org/llms.txt`
- Turborepo: `https://turbo.build/llms.txt`
- Drizzle ORM: `https://orm.drizzle.team/llms-full.txt`

#### Scenario: 验证所有预配置框架可同步
- **WHEN** 运行 `pnpm docs:sync` 且所有 URL 可访问
- **THEN** 系统成功下载所有 9 个框架的文档
- **AND** 系统在 `docs/` 目录下创建 9 个子目录，每个包含 `llms-full.txt` 和 `.version` 文件

#### Scenario: 部分框架 URL 失效时的容错
- **WHEN** 运行 `pnpm docs:sync` 但某个框架 URL 无法访问
- **THEN** 系统继续处理其他框架的同步
- **AND** 系统在输出中明确标记失败的框架
- **AND** 系统退出码为 0（不阻塞 CI/CD 流程）

### Requirement: .version 文件格式规范

系统 SHALL 为每个下载的文档生成 JSON 格式的 `.version` 文件，包含以下字段：

- `source_url` (string): 文档来源 URL
- `downloaded_at` (string): ISO 8601 格式的下载时间戳
- `content_hash` (string): SHA256 哈希值（小写十六进制）
- `file_size` (number): 文件大小（字节）

#### Scenario: 生成标准 .version 文件
- **WHEN** 系统下载一个新文档
- **THEN** 系统创建 `.version` 文件包含所有 4 个必需字段
- **AND** `downloaded_at` 字段使用 UTC 时区
- **AND** JSON 格式化为 2 空格缩进便于阅读

#### Scenario: .version 文件可被后续流程读取
- **WHEN** 其他脚本（如 `generate-meta.js`）需要读取版本信息
- **THEN** 系统能够解析 `.version` 文件为有效 JSON 对象
- **AND** 所有字段类型符合规范（string/number）

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

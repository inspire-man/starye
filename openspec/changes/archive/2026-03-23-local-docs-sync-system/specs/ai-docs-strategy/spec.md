## ADDED Requirements

### Requirement: .cursorrules 必须定义 AI 文档查找的技术栈映射

系统 SHALL 在 `.cursorrules` 文件中提供清晰的技术栈到文档路径的映射表，使 AI 能快速定位相关文档。

#### Scenario: 查找 Hono 文档
- **WHEN** AI 需要查询 Hono 框架的相关信息
- **THEN** AI 应参考 `.cursorrules` 中的映射找到 `docs/hono/llms-full.txt`

#### Scenario: 查找 Drizzle ORM 文档
- **WHEN** AI 需要查询 Drizzle ORM 的相关信息
- **THEN** AI 应参考 `.cursorrules` 中的映射找到 `docs/drizzle/llms-full.txt`

#### Scenario: 映射表包含所有支持的技术栈
- **WHEN** 开发者查看 `.cursorrules` 文档策略部分
- **THEN** 映射表 MUST 包含所有 9 个技术栈的条目
- **AND** 每个条目包含框架名称、文档路径、简短描述

### Requirement: .cursorrules 必须定义三层查找策略

系统 SHALL 在 `.cursorrules` 中定义快速路径、降级路径、兜底路径三层查找策略，确保 AI 能在不同情况下找到所需文档。

#### Scenario: 使用快速路径查找（章节索引）
- **WHEN** AI 需要查询某个技术栈的特定主题（如 "Hono CORS"）
- **THEN** AI SHOULD 首先读取 `docs/_sections.json`
- **AND** AI 根据关键词匹配找到相关章节
- **AND** AI 使用 `Read` 工具读取精确的行范围（`start_line` 到 `end_line`）

#### Scenario: 降级到 Grep 搜索
- **WHEN** 快速路径未能找到匹配的章节或 `_sections.json` 不存在
- **THEN** AI SHOULD 使用 `Grep` 工具在文档中搜索关键词
- **AND** AI 使用 `Read` 工具读取匹配结果的上下文

#### Scenario: 兜底使用 WebSearch
- **WHEN** 本地文档不存在或未覆盖查询主题
- **THEN** AI SHOULD 使用 `WebSearch` 工具查询官方网站
- **AND** AI 在响应中说明使用了 WebSearch 而非本地文档

### Requirement: .cursorrules 必须包含大文件处理指引

系统 SHALL 在 `.cursorrules` 中明确指示 AI 如何处理大型文档（如 Better Auth），避免性能问题。

#### Scenario: 处理标记了 size_warning 的文档
- **WHEN** AI 查询 `_sections.json` 发现某个框架有 `size_warning` 标记
- **THEN** AI MUST 使用章节索引进行精确行范围读取
- **AND** AI 不应尝试一次性读取整个文档

#### Scenario: 使用 offset 和 limit 参数
- **WHEN** AI 需要读取大型文档的某个章节
- **THEN** AI SHOULD 使用 `Read` 工具的 `offset` 和 `limit` 参数
- **AND** AI 避免读取不必要的内容

### Requirement: .cursorrules 必须说明文档查找的优先级

系统 SHALL 在 `.cursorrules` 中明确说明不同查找方法的适用场景和优先级。

#### Scenario: 优先使用本地文档
- **WHEN** 用户咨询的技术栈在映射表中存在
- **THEN** AI MUST 优先查阅本地文档而非使用 WebSearch
- **AND** AI 仅在本地文档无法回答问题时才使用 WebSearch

#### Scenario: 明确不支持的技术栈
- **WHEN** 用户咨询的技术栈不在映射表中（如 Tailwind CSS）
- **THEN** AI SHOULD 直接使用 WebSearch
- **AND** AI 可在响应中说明该技术栈未配置本地文档

### Requirement: AI 必须能够自动识别技术栈上下文

系统 SHALL 通过 `.cursorrules` 指引 AI 自动检测用户查询中涉及的技术栈，无需用户明确指定。

#### Scenario: 从用户查询中识别技术栈
- **WHEN** 用户提问 "如何用 Hono 配置 CORS？"
- **THEN** AI 应自动识别出涉及 Hono 框架
- **AND** AI 自动查阅 `docs/hono/llms-full.txt`

#### Scenario: 从代码上下文中识别技术栈
- **WHEN** 用户在编辑包含 `import { Hono } from 'hono'` 的文件时提问
- **THEN** AI 应从 import 语句推断出涉及 Hono 框架
- **AND** AI 在需要时查阅相关文档

#### Scenario: 识别多个技术栈的组合查询
- **WHEN** 用户提问 "如何在 Hono 中使用 Zod 验证？"
- **THEN** AI 应识别出涉及 Hono 和 Zod 两个框架
- **AND** AI 可查阅两个框架的文档提供综合答案

### Requirement: .cursorrules 必须提供示例说明查找流程

系统 SHALL 在 `.cursorrules` 中包含具体示例，演示 AI 应如何使用文档查找策略。

#### Scenario: 包含快速路径示例
- **WHEN** 开发者或 AI 查看 `.cursorrules` 文档策略
- **THEN** 规则中 MUST 包含使用 `_sections.json` 的示例代码或伪代码
- **AND** 示例展示如何从章节索引定位到精确行号

#### Scenario: 包含降级路径示例
- **WHEN** 开发者或 AI 查看 `.cursorrules` 文档策略
- **THEN** 规则中 MUST 包含使用 `Grep` 工具的示例
- **AND** 示例展示如何搜索关键词并读取上下文

#### Scenario: 示例使用实际的技术栈
- **WHEN** 开发者查看 `.cursorrules` 示例
- **THEN** 示例 SHOULD 使用项目实际使用的技术栈（如 Hono、Drizzle）
- **AND** 示例场景应贴近真实开发需求

### Requirement: AI 响应必须基于官方文档内容

系统 SHALL 通过 `.cursorrules` 要求 AI 在提供技术栈相关答案时，优先引用本地官方文档的内容。

#### Scenario: 引用文档来源
- **WHEN** AI 回答技术栈相关问题
- **THEN** AI SHOULD 在回答中标注信息来源（如 "根据 Hono 官方文档..."）
- **AND** AI 如果使用了 WebSearch，应明确说明

#### Scenario: 确保信息准确性
- **WHEN** AI 查阅本地文档后提供答案
- **THEN** AI MUST 基于文档的实际内容，不应凭记忆推测
- **AND** AI 如果文档内容与常识冲突，应以文档为准

#### Scenario: 处理文档版本问题
- **WHEN** AI 发现文档内容可能过时或与用户环境不符
- **THEN** AI SHOULD 在回答中提醒用户文档的更新时间（从 `_meta.json` 获取）
- **AND** AI 建议用户运行 `pnpm docs:sync` 更新文档

### Requirement: .cursorrules 必须说明文档更新流程

系统 SHALL 在 `.cursorrules` 中说明如何更新本地文档，便于开发者维护。

#### Scenario: 说明同步命令
- **WHEN** 开发者查看 `.cursorrules`
- **THEN** 规则中 MUST 明确说明运行 `pnpm docs:sync` 可同步所有文档
- **AND** 规则中建议的同步频率（如每周一次）

#### Scenario: 说明独立索引生成
- **WHEN** 开发者查看 `.cursorrules`
- **THEN** 规则中 SHOULD 说明 `pnpm docs:meta` 和 `pnpm docs:index` 的用途
- **AND** 规则中说明这些命令不会触发文档下载

## MODIFIED Requirements

### Requirement: .cursorrules 必须定义 AI 文档查找的技术栈映射

系统 SHALL 在 .cursorrules 中将当前托管技术栈映射到 docs/references/frameworks/{framework}/llms.txt，并指向 docs/generated/_sections.json 和 docs/generated/_meta.json。

#### Scenario: 查找 Hono 文档

- **WHEN** AI 需要查询 Hono 框架的相关信息
- **THEN** AI 参考 .cursorrules 中的映射找到 docs/references/frameworks/hono/llms.txt

#### Scenario: 查找 Drizzle ORM 文档

- **WHEN** AI 需要查询 Drizzle ORM 的相关信息
- **THEN** AI 参考 .cursorrules 中的映射找到 docs/references/frameworks/drizzle/llms.txt

#### Scenario: 映射表包含所有支持的技术栈

- **WHEN** 开发者查看 .cursorrules 文档策略
- **THEN** 映射表包含 11 个托管技术栈条目
- **AND** 每个条目包含框架名称、文档路径和简短描述

### Requirement: .cursorrules 必须定义三层查找策略

系统 SHALL 定义章节索引、关键词搜索、官方网络资料三层路径，并明确本地资料可能过期时读取 _meta.json 的更新时间和哈希。

#### Scenario: 使用快速路径查找（章节索引）

- **WHEN** AI 需要查询某个技术栈的特定主题
- **THEN** AI 首先读取 docs/generated/_sections.json
- **AND** AI 根据关键词匹配章节并读取精确行范围

#### Scenario: 降级到 Grep 搜索

- **WHEN** 章节索引未命中或不存在
- **THEN** AI 在对应的 llms.txt 中搜索关键词
- **AND** AI 读取匹配结果上下文

#### Scenario: 兜底使用 WebSearch

- **WHEN** 本地资料不存在、过期或未覆盖主题
- **THEN** AI 查询官方网络资料
- **AND** AI 说明使用了网络来源

### Requirement: .cursorrules 必须包含大文件处理指引

系统 SHALL 指示 AI 对大型 llms.txt 使用章节索引和行范围读取。

#### Scenario: 处理标记了 size_warning 的文档

- **WHEN** AI 查询 generated 索引发现文档较大
- **THEN** AI 使用章节索引定位范围
- **AND** AI 不一次性读取整个文档

#### Scenario: 使用 offset 和 limit 参数

- **WHEN** AI 需要读取大型文档的某个章节
- **THEN** AI 使用 Read 工具的 offset 和 limit
- **AND** AI 避免读取不必要的内容

### Requirement: .cursorrules 必须说明文档查找的优先级

系统 SHALL 明确本地资料优先、关键词搜索其次、官方网络资料兜底的优先级。

#### Scenario: 优先使用本地文档

- **WHEN** 用户咨询的技术栈在映射表中存在
- **THEN** AI 优先查阅本地文档
- **AND** 仅在本地资料无法回答时查阅网络资料

#### Scenario: 明确不支持的技术栈

- **WHEN** 用户咨询的技术栈不在映射表中
- **THEN** AI 直接查询官方网络资料
- **AND** AI 可说明该技术栈未配置本地文档

### Requirement: AI 必须能够自动识别技术栈上下文

系统 SHALL 指引 AI 从用户查询、代码 import 和组合问题识别技术栈。

#### Scenario: 从用户查询中识别技术栈

- **WHEN** 用户提问如何用 Hono 配置 CORS
- **THEN** AI 识别 Hono
- **AND** AI 查阅对应 references/frameworks 文档

#### Scenario: 从代码上下文中识别技术栈

- **WHEN** 用户在包含 Hono import 的文件中提问
- **THEN** AI 从代码上下文推断 Hono
- **AND** AI 在需要时查阅 Hono 文档

#### Scenario: 识别多个技术栈的组合查询

- **WHEN** 用户提问如何在 Hono 中使用 Zod 验证
- **THEN** AI 识别 Hono 和 Zod
- **AND** AI 可查阅两个框架的文档

### Requirement: .cursorrules 必须提供示例说明查找流程

系统 SHALL 提供索引定位和关键词搜索的实际示例。

#### Scenario: 包含快速路径示例

- **WHEN** 开发者或 AI 查看文档策略
- **THEN** 规则包含使用 _sections.json 的示例
- **AND** 示例展示从索引定位到行号

#### Scenario: 包含降级路径示例

- **WHEN** 开发者或 AI 查看文档策略
- **THEN** 规则包含使用 Grep 的示例
- **AND** 示例展示关键词和上下文读取

#### Scenario: 示例使用实际的技术栈

- **WHEN** 开发者查看示例
- **THEN** 示例使用 Hono、Drizzle 或其他项目实际技术栈
- **AND** 场景贴近真实开发需求

### Requirement: AI 响应必须基于官方文档内容

系统 SHALL 要求 AI 基于本地官方资料或明确标注的官方网络资料回答技术栈问题。

#### Scenario: 引用文档来源

- **WHEN** AI 回答技术栈相关问题
- **THEN** AI 标注信息来源
- **AND** 使用网络资料时明确说明

#### Scenario: 确保信息准确性

- **WHEN** AI 查阅本地文档后提供答案
- **THEN** AI 基于实际文本而不是记忆推测
- **AND** 文档与常识冲突时以文档内容为准

#### Scenario: 处理文档版本问题

- **WHEN** AI 发现文档可能过时或与用户环境不符
- **THEN** AI 读取 generated/_meta.json 的更新时间
- **AND** AI 建议运行 pnpm docs:sync

### Requirement: .cursorrules 必须说明文档更新流程

系统 SHALL 说明 pnpm docs:sync、pnpm docs:meta、pnpm docs:index 和 pnpm docs:check 的用途。

#### Scenario: 说明同步命令

- **WHEN** 开发者查看文档策略
- **THEN** 规则明确说明 pnpm docs:sync 同步托管资料
- **AND** 规则建议定期同步

#### Scenario: 说明独立索引生成

- **WHEN** 开发者查看文档策略
- **THEN** 规则说明 pnpm docs:meta 和 pnpm docs:index 只生成索引
- **AND** 规则说明 pnpm docs:check 执行离线完整性检查

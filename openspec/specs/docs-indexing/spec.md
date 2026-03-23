## ADDED Requirements

### Requirement: 系统能够扫描本地文档生成元数据索引

系统 SHALL 自动扫描 `docs/` 目录下所有框架的文档和 `.version` 文件，生成统一的元数据索引文件 `docs/_meta.json`。

#### Scenario: 生成包含所有框架的元数据索引
- **WHEN** 运行 `pnpm docs:meta` 且 `docs/` 目录包含多个框架子目录
- **THEN** 系统扫描所有包含 `llms-full.txt` 的子目录
- **AND** 系统生成 `docs/_meta.json` 文件包含每个框架的元数据条目
- **AND** 每个条目包含 `local_path`、`file_size`、`last_updated` 字段

#### Scenario: 元数据索引包含正确的文件信息
- **WHEN** 系统生成元数据索引
- **THEN** `file_size` 字段格式为 "{数值}KB"（如 "153.6KB"）
- **AND** `last_updated` 字段格式为 ISO 8601 日期（如 "2026-03-23"）
- **AND** `local_path` 字段为相对路径（如 "docs/hono/llms-full.txt"）

#### Scenario: 忽略不完整的文档目录
- **WHEN** 某个子目录缺少 `llms-full.txt` 文件
- **THEN** 系统跳过该目录不将其加入元数据索引
- **AND** 系统在控制台输出警告信息

### Requirement: 系统能够解析文档章节结构生成索引

系统 SHALL 扫描每个文档的 Markdown 标题（`#` 标记），提取章节信息并生成 `docs/_sections.json` 索引文件。

#### Scenario: 识别 Markdown 标题层级
- **WHEN** 系统解析一个包含 Markdown 标题的文档
- **THEN** 系统正确识别不同层级的标题（`#` 为 level 1，`##` 为 level 2，依此类推）
- **AND** 系统记录每个标题的 `title`、`level`、`start_line` 字段

#### Scenario: 计算章节的行范围
- **WHEN** 系统遇到一个章节标题
- **THEN** 系统记录该章节的起始行号（`start_line`）
- **AND** 系统在遇到下一个同级或更高级标题时，记录上一个章节的结束行号（`end_line`）
- **AND** 文档末尾的章节 `end_line` 设置为文档总行数

#### Scenario: 维护章节的层级关系
- **WHEN** 系统解析包含嵌套标题的文档（如 `## Section` 下有 `### Subsection`）
- **THEN** 系统在父章节对象中创建 `subsections` 数组
- **AND** 子章节对象包含在父章节的 `subsections` 数组中
- **AND** 顶级章节直接存储在框架的 `sections` 数组中

#### Scenario: 提取章节关键词
- **WHEN** 系统处理章节标题
- **THEN** 系统将标题文本转为小写并按空格、连字符、下划线分词
- **AND** 系统过滤掉长度小于 3 的词
- **AND** 系统将提取的关键词存储在 `keywords` 数组中

### Requirement: _sections.json 文件格式规范

系统 SHALL 生成符合以下结构的 `_sections.json` 文件：

```json
{
  "{framework}": {
    "file": "docs/{framework}/llms-full.txt",
    "sections": [
      {
        "title": "章节标题",
        "level": 2,
        "start_line": 50,
        "end_line": 120,
        "keywords": ["keyword1", "keyword2"],
        "subsections": [...]
      }
    ]
  }
}
```

#### Scenario: 章节对象包含所有必需字段
- **WHEN** 系统生成章节索引
- **THEN** 每个章节对象 MUST 包含 `title`、`level`、`start_line`、`end_line` 字段
- **AND** `keywords` 字段 MUST 存在且为字符串数组（可为空）
- **AND** `subsections` 字段仅在有子章节时存在

#### Scenario: 行号范围有效且不重叠
- **WHEN** 系统计算章节行范围
- **THEN** 每个章节的 `start_line` MUST 小于或等于 `end_line`
- **AND** 同级章节之间不应有行号重叠（除非是嵌套关系）

### Requirement: 索引生成必须处理异常情况

系统 SHALL 在索引生成过程中优雅地处理各种异常情况，不应因单个文档错误而中断整个流程。

#### Scenario: 文档格式无法解析时的容错
- **WHEN** 某个文档不包含有效的 Markdown 标题或格式异常
- **THEN** 系统为该框架返回空的 `sections` 数组
- **AND** 系统在控制台输出警告消息（如 "Warning: Failed to index {framework}"）
- **AND** 系统继续处理其他框架的文档

#### Scenario: 文件读取失败时的容错
- **WHEN** 某个文档文件无法读取（权限问题或文件损坏）
- **THEN** 系统跳过该框架不将其加入章节索引
- **AND** 系统输出错误消息但不抛出异常终止程序

#### Scenario: JSON 生成失败时的提示
- **WHEN** 系统无法将索引数据序列化为 JSON（如循环引用）
- **THEN** 系统输出明确的错误消息指示问题所在
- **AND** 系统退出码为非零值表示失败

### Requirement: 索引文件必须便于 AI 工具读取

系统 SHALL 生成格式化良好的 JSON 文件，便于 AI 工具高效解析和使用。

#### Scenario: JSON 格式化便于人类阅读
- **WHEN** 系统生成 `_meta.json` 或 `_sections.json`
- **THEN** JSON 文件使用 2 空格缩进格式化
- **AND** 文件末尾包含换行符

#### Scenario: 索引文件大小合理
- **WHEN** 系统生成 `_sections.json`
- **THEN** 文件大小 SHOULD 不超过 500KB（即使包含所有 9 个框架）
- **AND** 如果文件过大，系统输出警告建议优化

#### Scenario: 索引文件与文档同步
- **WHEN** 运行 `pnpm docs:sync`
- **THEN** 系统在文档下载完成后自动运行 `generate-meta.js` 和 `generate-sections.js`
- **AND** 索引文件始终反映最新的文档内容

### Requirement: 支持独立运行索引生成脚本

系统 SHALL 允许开发者单独运行索引生成脚本，无需重新下载文档。

#### Scenario: 单独生成元数据索引
- **WHEN** 运行 `pnpm docs:meta`
- **THEN** 系统仅扫描现有文档生成 `_meta.json`
- **AND** 系统不触发文档下载

#### Scenario: 单独生成章节索引
- **WHEN** 运行 `pnpm docs:index`
- **THEN** 系统仅解析现有文档生成 `_sections.json`
- **AND** 系统不触发文档下载或元数据生成

#### Scenario: 索引生成脚本输出清晰的进度
- **WHEN** 运行索引生成脚本
- **THEN** 系统显示 "Indexing {framework}..." 进度消息
- **AND** 系统显示 "Generated docs/_meta.json" 或 "Generated docs/_sections.json" 成功消息

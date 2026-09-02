## Purpose

定义如何扫描托管框架资料并生成供人和 agent 定向读取的元数据、章节层级、关键词、行范围索引，并支持 CI 校验生成物一致性。

## Requirements

### Requirement: 系统能够扫描本地文档生成元数据索引

系统 SHALL 只扫描 docs/references/frameworks/ 下由来源清单管理的 llms.txt，并生成 docs/generated/_meta.json。每条记录 MUST 包含 local_path、file_size、last_updated、source_url 和 content_hash。

#### Scenario: 生成包含所有框架的元数据索引

- **WHEN** 运行 pnpm docs:meta 且 docs/references/frameworks/ 包含多个托管文档目录
- **THEN** 系统扫描所有清单中的 llms.txt
- **AND** 系统生成 docs/generated/_meta.json 并包含每个有效框架条目

#### Scenario: 元数据索引包含正确的文件信息

- **WHEN** 系统生成元数据索引
- **THEN** file_size、last_updated、source_url 和 content_hash 反映对应文件和 .version
- **AND** local_path 指向 docs/references/frameworks/{framework}/llms.txt

#### Scenario: 忽略不完整的文档目录

- **WHEN** 某个框架目录缺少 llms.txt
- **THEN** 系统跳过该目录并输出警告
- **AND** 不把不完整目录加入元数据索引

### Requirement: 系统能够解析文档章节结构生成索引

系统 SHALL 扫描每个托管 llms.txt 的 Markdown 标题并生成 docs/generated/_sections.json，记录标题层级、行范围、关键词和嵌套关系。

#### Scenario: 识别 Markdown 标题层级

- **WHEN** 系统解析一个包含 Markdown 标题的托管文档
- **THEN** 系统识别不同标题层级并记录 level
- **AND** 系统记录 title 和 start_line

#### Scenario: 计算章节的行范围

- **WHEN** 系统遇到章节标题和下一个同级或更高级标题
- **THEN** 系统记录 start_line 和 end_line
- **AND** 文档末尾章节的 end_line 为文档总行数

#### Scenario: 维护章节的层级关系

- **WHEN** 文档包含嵌套标题
- **THEN** 系统把子章节放入父章节的 subsections
- **AND** 顶级章节放入对应框架的 sections

#### Scenario: 提取章节关键词

- **WHEN** 系统处理章节标题
- **THEN** 系统按空格、连字符和下划线分词并过滤长度小于 3 的词
- **AND** 系统把结果写入 keywords

### Requirement: _sections.json 文件格式规范

系统 SHALL 生成 docs/generated/_sections.json，并以框架 ID 组织 file 和 sections。

#### Scenario: 章节对象包含所有必需字段

- **WHEN** 系统生成章节索引
- **THEN** 每个章节对象包含 title、level、start_line 和 end_line
- **AND** keywords 为字符串数组，存在子章节时才写入 subsections

#### Scenario: 行号范围有效且不重叠

- **WHEN** 系统输出同级或嵌套章节
- **THEN** start_line 小于或等于 end_line
- **AND** 同级章节的行范围不重叠

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

系统 SHALL 生成格式化且可被 agent 定向读取的 JSON 索引。

#### Scenario: JSON 格式化便于人类阅读

- **WHEN** 系统生成 docs/generated/_meta.json 或 docs/generated/_sections.json
- **THEN** JSON 使用 2 空格缩进并以换行结尾

#### Scenario: 索引文件大小合理

- **WHEN** 系统为所有托管框架生成章节索引
- **THEN** docs/generated/_sections.json 保持在 500KB 以内
- **AND** 超过限制时输出警告

#### Scenario: 索引文件与文档同步

- **WHEN** 运行 pnpm docs:sync
- **THEN** 系统在同步后生成最新的 _meta.json 和 _sections.json
- **AND** 两个文件只包含当前有效托管资料

### Requirement: 支持独立运行索引生成脚本

系统 SHALL 支持不下载外部资料而独立生成两个索引。

#### Scenario: 单独生成元数据索引

- **WHEN** 运行 pnpm docs:meta
- **THEN** 系统只扫描现有资料并生成 docs/generated/_meta.json
- **AND** 系统不发起文档下载

#### Scenario: 单独生成章节索引

- **WHEN** 运行 pnpm docs:index
- **THEN** 系统只解析现有资料并生成 docs/generated/_sections.json
- **AND** 系统不发起文档下载

#### Scenario: 索引生成脚本输出清晰的进度

- **WHEN** 运行任一独立索引命令
- **THEN** 系统输出正在处理的框架和生成文件路径

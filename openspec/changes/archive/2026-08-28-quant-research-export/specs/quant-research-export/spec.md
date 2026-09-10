# quant-research-export Specification

## ADDED Requirements

### Requirement: Export an existing research report

当当前股票存在已保存的研究报告时，Quant 详情 MUST 提供 Markdown 导出操作。导出 MUST 使用页面当前已加载的报告数据，并生成一个本地 Markdown 文件；报告不存在时 MUST 不触发下载。

#### Scenario: Report is available

- **WHEN** 当前股票已有结构化研究报告
- **THEN** 页面显示 Markdown 导出操作
- **AND** 用户触发后得到以股票代码和生成日期命名的 Markdown 文件

#### Scenario: Report is unavailable

- **WHEN** 当前股票没有研究运行或研究历史仍在加载
- **THEN** 页面不显示可执行的报告导出操作
- **AND** 不生成空报告或伪造的占位证据

### Requirement: Preserve report evidence and provenance

导出的 Markdown MUST 包含报告版本、生成时间、状态、研究动作、分数（若有）、标题、支持依据、风险核对、数据缺口、下一步、每条证据的状态/原始值/阈值/来源/观察时间/公式版本，以及来源快照。空值 MUST 保持为明确的数据缺口语义。

#### Scenario: Export a complete report

- **WHEN** 报告包含多维证据和来源
- **THEN** 导出文件按固定分节保留这些字段
- **AND** 导出内容可以脱离页面用于人工复核

#### Scenario: Export a partial report

- **WHEN** 报告存在缺失证据、空列表或未记录观察时间
- **THEN** 导出文件明确标注缺失或暂无记录
- **AND** 不用零值、默认状态或新事实填充缺口

### Requirement: Export is local and bounded

导出 MUST 仅使用当前页面已有的结构化报告和可选 AI 摘要，不发送网络请求，不包含 API key、token、cookie、内部 provider 配置或未经白名单允许的对象字段。导出动作 MUST NOT 修改研究运行、候选评分、研究标记或研究排序。

#### Scenario: Include an existing AI summary

- **WHEN** 当前报告已有 AI 摘要
- **THEN** 导出文件可包含摘要概览、支持点、关注点、下一步和引用证据 key
- **AND** 不包含 AI 配置中的密钥或连接信息

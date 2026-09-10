## Why

当前 Quant 研究报告已经能把本地日线、估值、财务和分红整理成可回看的证据链，但数据来源仍集中在 Worker 内的现有 provider，且报告只能由用户自行阅读。AkShare 适合补充公开行情与财务字段，却属于 Python 生态；需要一个独立 bridge 把 DataFrame 转成稳定 contract，再让用户已配置的 AI 只对确定性证据做解释，降低金融小白理解报告的成本。

## What Changes

- 新增独立 Python AkShare bridge 服务，提供健康检查和标准化 Quant evidence 接口。
- bridge 统一股票代码、日期、字段、来源、观察时间、公式版本和错误分类；原始 DataFrame 不离开 bridge。
- API 新增可选 AkShare bridge provider client；研究运行在 bridge 可用时追加 AkShare 证据，bridge 失败时保留确定性报告并标记数据缺口。
- 研究报告版本升级为可兼容的 `research-report-v2`，保留读取历史 `research-report-v1` 的能力。
- 新增用户级 AI 摘要生成和历史读取接口，摘要只允许引用当前研究报告已有的证据 key。
- 新增研究摘要持久化表；摘要记录用户、研究运行、provider/model、生成时间、来源报告版本和引用证据。
- Quant 分析抽屉增加解释性摘要入口、生成状态、失败状态和引用证据展示。

## Capabilities

### New Capabilities

- `quant-akshare-bridge`: 独立 AkShare 服务和版本化标准证据 contract。
- `quant-evidence-enrichment`: Worker 消费 bridge 结果并把可验证来源纳入研究报告。
- `quant-ai-research-summary`: 基于确定性研究报告生成、校验和持久化用户级解释性摘要。

### Modified Capabilities

- `quant-ai-config`: 现有用户 AI 配置被研究摘要 runtime 消费；保留密钥不出 API 响应的边界。

## Impact

- 新增 `apps/quant-akshare-bridge` Python 服务、contract、适配器和测试。
- `apps/api` 新增 bridge client、AI summary domain、路由和 provider/错误配置。
- `packages/db` 新增研究摘要 schema、D1 migration 和 readback 测试。
- `apps/quant-app` 新增摘要 API 类型、生成操作和证据引用面板。
- 新增 API/bridge 配置：`QUANT_AKSHARE_BRIDGE_URL`、`QUANT_AKSHARE_BRIDGE_TOKEN`、`QUANT_AKSHARE_BRIDGE_TIMEOUT_MS`。
- Python bridge 需要独立 Python runtime 与 AkShare 依赖；Worker 不新增 Python 或 pandas 依赖。

## Risks

- AkShare 上游字段和可用性变化：bridge 采用字段别名映射、有限行数、超时和错误分类；缺失字段保持 `null`，不伪造值。
- bridge 不可达：研究报告仍可由已有来源生成，并将 bridge 来源标记为 unavailable，不阻断用户查看已有证据。
- AI 输出不可信：只保存通过 schema、证据 key 引用校验和长度限制的摘要；原始证据、确定性分数和研究动作保持独立。
- 用户 AI endpoint 配置可能不可达：调用使用 Worker 超时和统一错误分类，失败不写入伪造摘要。
- 外部接口包含用户密钥：密钥只在 Worker 内解密并放入受控上游请求 header，日志、D1 和响应均不记录明文。

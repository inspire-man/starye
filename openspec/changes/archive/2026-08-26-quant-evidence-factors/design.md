## Context

现有 `quant-akshare-v1` contract 已限制 daily bars、financial rows 和 evidence 数量，Worker 也已经把 bridge evidence 追加到 `research-report-v2`。本 change 只丰富 bridge evidence 与消费层，不需要新的 D1 表；历史报告仍按原版本读取。详见 `proposal.md` 和 `specs/quant-evidence-factors/spec.md`。

## Goals / Non-Goals

**Goals:**

- 在 bridge 内完成单位一致、边界受控的因子计算，让 Worker 只消费稳定证据。
- 用相同的 evidence key 贯通报告、AI prompt 和 Quant 详情抽屉。
- 对同一指标的不同 provider 保持可见的来源和日期，不把交叉核对伪装成新事实。

**Non-Goals:**

- 不升级 bridge contract 版本，不迁移历史 report JSON，不调整核心评分权重。
- 不把 optional AkShare evidence 变成研究动作的硬门槛。

## Decisions

### 1. 因子计算留在 bridge

日线收益和 AkShare 财务因子在 Python bridge 计算并标准化，Worker 不引入 pandas，也不对原始 provider 行做二次猜测。财务因子取最新有效报告行；日线收益取返回窗口内最近 20 个有效收盘价，窗口不足则 `missing`。

### 2. 每个因子一个稳定 key

使用 `akshare-return20`、`akshare-roe`、`akshare-revenue-yoy`、`akshare-net-profit-yoy`、`akshare-gross-margin`、`akshare-net-margin`、`akshare-debt-asset-ratio`。样本数证据保留，因子均标记为 optional，避免未经重新校准就改变现有报告 score/action。

### 3. 交叉核对使用 detail，不合并值

报告构建器根据 AkShare 因子和最新 Eastmoney 财务值生成简短的 agreement/caution detail，必要时增加 `akshare-cross-check-*` optional evidence。两侧原始证据仍独立保存；日期不一致时只标注“报告期不同，需人工核对”。

### 4. AI 继续使用严格 JSON

摘要 schema 不新增自由文本字段。prompt 增加来源日期、公式版本和 provider 差异说明，现有 evidence-key 白名单校验继续作为最后边界；摘要失败时确定性报告照常显示。

### 5. UI 使用现有研究证据行

不再复制一套指标卡。现有研究抽屉的 evidence row 增加维度分组和 AkShare 因子 value 格式化；metadata 使用现有 title tooltip，适配移动端堆叠布局。

## Risks / Trade-offs

- [字段单位漂移] -> bridge 只接受有限数值，保留 endpoint、公式版本和原始观测日期；测试覆盖中文别名和缺失值。
- [跨来源报告期不同] -> 不比较不同日期的值，detail 明确指出不可直接比较。
- [因子数量增加导致摘要变长] -> 保持 evidence 32 项上限，prompt 仍有长度上限，UI 只改变分组和可读性。
- [旧报告缺少新增 key] -> parser 继续按已存在 evidence 读取，AI 白名单从当前报告动态生成。

## Migration Plan

1. 先部署 bridge 代码和 contract-compatible evidence；旧 Worker 可忽略新增 evidence。
2. 部署 API 和 Quant app；新研究运行生成 granular evidence，历史报告不重写。
3. 验证 bridge ready/partial/unavailable、报告 score/action 不变、AI 摘要引用合法 key。
4. 回滚应用代码时保留 bridge 和历史 report；不需要 D1 rollback。

# quant-screening Specification

## Purpose
定义 Tushare provider、积分能力 registry 和 v1 动量筛选因子。

## Requirements

### Requirement: Provider 边界

Tushare HTTP 调用 MUST 只存在于 provider 层。provider MUST 对响应进行 schema 校验和字段标准化；未知 `api_name`、缺 token、非成功响应和配额耗尽 MUST fail-closed。

#### Scenario: 日线 provider

- **WHEN** provider 请求 `daily`
- **THEN** 请求体包含服务端 token、合法代码和日期范围
- **AND** 返回标准化 `DailyBar`，不携带原始 token 或未声明字段

#### Scenario: 未知接口

- **WHEN** 任意调用请求未注册的 `api_name`
- **THEN** provider 拒绝请求且不发送外部 HTTP 请求

### Requirement: Capability registry

能力 registry MUST 使用能力名称和 provider 合同判断可用性，不允许业务模块直接比较积分数字。v1 MUST 注册 `daily`，并声明 `stock_basic`、`trade_cal`、`daily_basic` 的未来能力边界而不注册假实现。

#### Scenario: 因子能力缺失

- **WHEN** 某因子声明的 capability 未启用
- **THEN** 该因子不进入执行列表
- **AND** 结果包含稳定的缺能力原因

### Requirement: `momentum-v1` 动量因子

v1 动量筛选 MUST 只依赖标准化日线，并固定以下定义：

- `ma5`/`ma20` 是最新 5/20 根 `close` 的算术平均，历史不足时为 `null`。
- `isNewHigh20` 是最新 `close >= max(last20.close)`，比较 `close` 而不是 `high`，历史不足 20 根时为 `null`。
- `consecutiveUpDays` 是截至最新一根的严格收盘递增连续段长度；相等或下降即停止，历史少于 2 根时为 `null`，命中阈值为 `>= 3`。
- `volumeRatio` 是最新 `volume / mean(previous5.volume)`；历史少于 6 根或基准均值小于等于 0 时为 `null`，命中阈值为 `>= 1.2`。
- `return20` 是 `close[-1] / close[-21] - 1`，窗口包含最新 21 根 bar，因此实际计算 20 个价格间隔；历史不足 21 根时为 `null`。
- `relativeStrength` 只在当前观察池内按 `return20` 降序归一化排名；单只股票为 `1`，多只股票最高为 `1`、最低为 `0`，收益相同按 `ts_code` 升序打破平局，缺少 `return20` 时为 `null`。

命中标签 MUST 使用稳定含义：`ma5` 表示 `ma5 >= ma20`，`ma20` 表示 MA20 数据可用，其他标签分别对应新高、连涨、量比和相对强度阈值命中；`score` MUST 等于命中标签数，排序 MUST 依次使用 `score` 降序、`relativeStrength` 降序和 `ts_code` 升序。缺少足够历史数据的因子 MUST 返回缺数据信号而不是填充伪值，候选 MUST 标记 `dataQuality=insufficient_data` 并携带 `factorVersion=momentum-v1`。

#### Scenario: 候选排序

- **WHEN** 观察池有足够日线数据并运行筛选
- **THEN** 每只股票返回因子值、命中项和数据质量状态
- **AND** 候选排序规则稳定且包含 factor version

#### Scenario: 因子边界与 score

- **WHEN** 一只股票只有 21 根递增收盘日线，最新成交量是前 5 根均值的 2 倍
- **THEN** `ma5`、`ma20`、20 根收盘新高、连续上涨、`volumeRatio=2` 和 `return20` 均按上述公式计算
- **AND** `return20` 的分母是 21 根 bar 窗口最早一根收盘价，结果表示 20 个价格间隔的收益
- **AND** 任一历史窗口不足时对应字段为 `null`，score 和排序保持确定性

### Requirement: 可重复 provider fixture

用于成功同步验收的 provider MUST 支持注入本地 Tushare HTTP fixture。fixture MUST 对 `api_name=daily`、代码和日期参数做确定性响应，并返回固定字段和固定日线集合；验收不能依赖真实 Tushare token、配额或外部网络。fixture 返回超过 120 根数据时，业务层仍 MUST 按 120 根日线窗口落库和计算筛选。

#### Scenario: fixture-backed daily response

- **WHEN** 测试环境通过 `TUSHARE_BASE_URL` 指向可重复 fixture，并配置测试 token
- **THEN** provider 收到固定的 `daily` 请求并返回相同的标准化日线
- **AND** 同步结果可在 API 与 D1 `quant_daily_bar`、`quant_scan_snapshot`、`quant_sync_state` 中读回同一批次证据

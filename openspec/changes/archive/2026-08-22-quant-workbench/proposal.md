## Why

Starye 目前没有面向 A 股数据的观察池、日线同步和动量筛选工作台。需要先交付一个只依赖 Tushare `daily` 能力的可用 v1，同时把积分能力、数据供应商和筛选因子隔离，避免未来接入基础信息或估值数据时重写现有流程。

本 change 采用独立 `apps/quant-app`，通过现有 Gateway 的 `/quant` 访问；Gateway 本地 quant 上游端口固定使用 `3004`，避免占用现有 Blog 的 `3002`。Gateway 本身仍以 `8080` 作为统一入口，实现验证必须经过 `http://localhost:8080`，而不是直接把应用端口当作最终入口。

120 积分 v1 不调用 `trade_cal`。默认同步请求覆盖最近 180 个自然日，provider 返回后按交易日规范化、去重、升序排列，再为每只股票保留最新最多 120 根日线；节假日、停牌日等缺失日期保持缺失，不补造交易日。这里的“120 根”是 provider 返回的日线条数，不是由交易日历计算出的精确 120 个交易日。

## What Changes

- 新增 `apps/api` 下的 quant 域：Tushare provider、能力 registry、日线同步、观察池、动量筛选和快照查询。
- 新增 `/api/quant/*` API，所有工作台读写接口需要管理员会话；Tushare token 只在 Worker 服务端读取。
- 新增 v1 D1 表：观察池、日线、筛选快照、同步状态；不把估值字段写入日线表。
- 新增独立 `apps/quant-app`，提供观察池、同步台、候选快照、个股日线和能力状态。
- Gateway 新增 `/quant` 代理与 Dashboard 同等级的前置鉴权；本地编排新增 `3004` quant 服务。
- 同步调度固定 provider 并发上限、单请求超时和单次总时限；同一 `daily` 全局同步使用 D1 租约/CAS 保护，活动任务期间的重复请求返回稳定的进行中状态。
- 筛选固定 `momentum-v1` 的窗口、阈值、池内相对强度、score 和排序口径；缺少历史数据只产生缺数据信号。
- 成功同步的浏览器 E2E 使用可重复的本地 Tushare fixture，且必须同时通过 API、页面和 D1 权威读回确认；fixture 不依赖外网或真实 token。
- capability registry 固定 120 积分默认只暴露 `daily`；`stock_basic`、`trade_cal`、`daily_basic` 只作为未启用能力声明，不写假 provider 或禁用业务分支。
- **BREAKING**：量化接口统一使用 `/api/quant` 前缀，旧路径不作为兼容入口。

## Capabilities

### New Capabilities

- `quant-api`: 量化工作台 API、管理员鉴权、能力状态和同步错误契约。
- `quant-data`: 量化 D1 数据模型、日线幂等写入、观察池和同步状态。
- `quant-screening`: Tushare provider 能力门控、日线标准化和动量因子筛选。
- `quant-ui-gateway`: 独立量化前端、Gateway `/quant` 路由和本地开发入口。

### Modified Capabilities

- 无。

## Impact

- 代码：`apps/api`、`packages/db`、`apps/gateway`、`scripts/local-dev.ts`、新建 `apps/quant-app`。
- 工具链：API 类型检查、D1 migration、本地 Gateway E2E；生产 Pages project、URL 和 secret provisioning 需在实际资源创建后单独配置。
- 风险：Gateway 与本地服务编排是共享路径；D1 迁移会影响 API 启动；Tushare 外部配额和响应字段必须通过 provider mock 与 fail-closed 测试隔离；多 Worker/重复点击可能让全局同步状态互相覆盖，需用 D1 租约和 CAS 收口。
- 风险：provider 响应慢时，串行请求会超过 Worker 生命周期；固定并发和总时限后，未完成股票必须进入 `partial`/`rejected`，且不能生成伪成功快照。

## Acceptance Baseline

- `TUSHARE_POINTS_TIER` 缺省或为 `120` 时只有 `daily` 能力可用，未知或负值配置 fail-closed。
- 未登录请求经 `http://localhost:8080/quant/` 跳转到登录；管理员可完成“加入观察池 → 同步 → 候选 → 日线”流程，且 Gateway 的本地 quant 上游为 `3004`。
- 同一股票、交易日重复同步不会产生重复日线；同步状态可在 D1 权威读回中解释成功、部分成功或拒绝原因；同一时刻只有一个 `daily` 同步持有租约。
- provider 调用最多并发 4 个、单调用超时 10 秒、单次同步总时限 120 秒；截止时仍未开始或未完成的股票计入跳过/错误范围，结果按已写入数据返回 `partial` 或 `rejected`。
- 每次 `completed` 或 `partial` 同步最多保留最近 30 个有效筛选快照；`rejected` 只更新全局同步状态，不创建候选快照，清理发生在新快照持久化成功之后。
- `momentum-v1` 明确使用 MA5/MA20 收盘均线、收盘价 20 根窗口新高、严格收盘连涨、最近 5 根历史成交量均值的量比和池内 `return20` 排名；`return20` 使用 21 根 bar、20 个价格间隔的 `close[-1] / close[-21] - 1`，并固定 score 与排序规则。
- 成功同步 E2E 使用固定本地 Tushare fixture，经 Gateway 浏览器完成观察池和同步操作；随后验证页面结果、API `completed`/`snapshotId`、`quant_daily_bar`、`quant_scan_snapshot` 和 `quant_sync_state` 的 D1 readback 相互一致。
- 定向单测、API/D1 契约测试、四个 app 的 type-check 通过。

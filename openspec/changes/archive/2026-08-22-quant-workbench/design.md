## Context

见 `proposal.md`。当前 Gateway 是统一入口，应用端口由 `scripts/local-dev.ts` 集中管理；Gateway 监听 `8080`，其本地 quant 上游固定为 `3004`；API 使用 Hono 链式 route、全局 database/auth middleware，D1 schema 位于 `packages/db/src/schema.ts`。当前 target profile 只有既有五个 Pages surface，因此本 change 先完成本地 Gateway 和 quant app 链路，不把未创建的生产 Pages project 写入 tracked profile。

## Goals / Non-Goals

**Goals:**

- 交付可在本地 Gateway 使用的量化 v1 端到端链路。
- 让 provider、capability、factor、sync 和 API 之间有清楚的合同。
- 让 D1 数据可幂等写入、可追踪并能被权威读回。
- 让单次同步有明确的 provider 并发上限、单请求超时、总时限、全局互斥和快照保留边界。
- 让 120 积分下的日线窗口和 `momentum-v1` 因子口径可由测试与 D1 readback 复现。
- 保持现有应用路由和部署 target 的行为不变。

**Non-Goals:**

- 不做全市场扫描、回测、分钟线、独立 Worker、财务指标或真实 2000 积分业务。
- 不创建未确认的 Cloudflare Pages 项目、域名、生产 secret 或远程资源。
- 不将 Tushare 外部网络调用作为单测前置条件。

## Decisions

### 1. 独立 app，Gateway 本地 quant 上游端口 3004

采用独立 Vite Vue app，使用 `/quant/` base path，监听本地 `3004`，由监听 `8080` 的 Gateway 代理。原因是现有 Dashboard 是内容运管台，量化工作台有不同的信息密度和交互模型；3002 已由 Blog 使用。生产 Pages 接入另行在资源确定后扩展 target profile。

### 2. `/api/quant` 与服务端 capability registry

API 挂载到现有 Hono app 的 `/api/quant`。registry 接受显式 tier，返回不可变能力清单；业务只消费 `hasCapability()` 和 `requires`，不直接读取积分数字。Tushare client 仅由 provider 调用。

### 3. 四张 v1 表

v1 使用四张独立表：watchlist、daily bar、scan snapshot、sync state。股票基础信息、交易日历、估值表位延后到真实能力实现时迁移，避免空表和无消费者 schema。

### 4. 同步先完成再筛选，且固定 120 根日线语义

同步以观察池为输入，限制 50 个代码。120 积分 v1 不调用 `trade_cal`：默认请求范围是结束于当前 UTC 日期的最近 180 个自然日；provider 返回后过滤请求边界、按 `trade_date` 去重并升序排序，每个 `ts_code` 只保留最新最多 120 根日线。显式 `from_date`/`to_date` 仍遵守同一条数上限，缺失的节假日或停牌日保持缺失。

provider 调度采用固定的 `MAX_PROVIDER_CONCURRENCY=4`、单请求 `10s` 超时和单次同步 `120s` 总时限。到达总时限时，已完成的股票仍可写入；尚未完成的股票计入跳过范围，至少有一只成功时生成 `partial`，一只也没有成功时生成 `rejected`，不生成伪成功快照。

`quant_sync_state` 是 `id='daily'` 的全局状态。同步开始时通过 D1 原子条件更新取得 `run_id` 和租约；存在未过期租约时直接返回 `409 QUANT_SYNC_IN_PROGRESS`，不触发 provider。结束写入和错误状态必须携带 owner `run_id` 做 CAS，过期租约才允许新 run 接管，旧 run 的迟到结果不能覆盖新状态。

候选快照只在 `completed`/`partial` 的数据写入和候选计算完成后持久化；`rejected` 只更新 `quant_sync_state`。`quant_scan_snapshot` 保留最近 30 个有效快照，新的快照完成权威写入后再删除更旧行；清理失败不能把已经持久化的有效同步改报为 `rejected`，但应记录可观测错误。

### 5. API 类型与前端 client

新增 API route 继续加入 Hono `routes` 链，前端通过本地 typed client 封装请求。由于当前 `@starye/api-types` 依赖构建产物且存在旧 RPC 迁移 change，量化 client 先使用与 Valibot 响应一致的显式类型，待 API 类型构建链稳定后再接入共享 `AppType`。

### 6. `momentum-v1` 因子合同

所有输入先按 `trade_date` 升序处理，因子只读标准化日线的 `close` 和 `volume`，不填充缺失历史。定义如下：

- `ma5` 是最新 5 根收盘价的算术平均，少于 5 根为 `null`；`ma20` 同理使用最新 20 根，少于 20 根为 `null`。
- `isNewHigh20` 是最新收盘价大于或等于最近 20 根收盘价的最大值，比较字段是 `close` 而不是 `high`；少于 20 根为 `null`。
- `consecutiveUpDays` 是截至最新一根、相邻收盘价严格递增的连续段长度；相等或下降即停止，少于 2 根为 `null`；命中阈值为 `>= 3`。
- `volumeRatio` 是最新成交量除以前 5 根成交量的算术平均；少于 6 根或历史均值小于等于 0 为 `null`；命中阈值为 `>= 1.2`。
- `return20` 是最新收盘价除以 21 根 bar 窗口最早一根收盘价再减一，即 `close[-1] / close[-21] - 1`。因此 21 根数据包含 20 个收盘价间隔；少于 21 根为 `null`。
- `relativeStrength` 只在候选池内按 `return20` 降序排名，收益相同按 `ts_code` 升序打破平局；单只股票为 `1`，多只股票最高为 `1`、最低为 `0`，缺少 `return20` 为 `null`。命中阈值为 `>= 0.5`。

`matchedFactors` 使用稳定标签：`ma5` 表示 MA5 >= MA20，`ma20` 表示 MA20 数据可用，`new_high_20`、`continuation`、`volume_ratio` 和 `relative_strength` 分别表示上述阈值命中；`score` 是命中标签数量，候选先按 `score` 降序、再按 `relativeStrength` 降序、最后按 `ts_code` 升序排列。缺失任一因子时 `dataQuality=insufficient_data`，相应值和标签保持可解释的 `null`/缺失状态；每个候选和快照都携带 `factorVersion=momentum-v1`。

### 7. 可重复的成功 E2E 证据

成功同步验收使用本地 HTTP Tushare fixture，通过 `TUSHARE_BASE_URL` 注入 API；fixture 固定检查 `api_name=daily`、代码和日期参数，并返回固定字段顺序、固定 125 根日线和固定数值。token 使用测试值，真实 Tushare 网络不参与验收。浏览器始终从 `http://localhost:8080/quant/` 进入，完成观察池、同步、候选和日线流程；同步返回的 `snapshotId`、页面候选、API 查询结果和 D1 中 `quant_daily_bar`、`quant_scan_snapshot`、`quant_sync_state` 的行必须相互对应。重复点击同步后，日线唯一键计数保持 120 根/代码，快照按策略新增而不是产生重复日线。

## Risks / Trade-offs

- [Tushare 配额或网络波动] -> provider mock、请求超时、配额错误码和 sync partial/rejected 状态；不把 200 响应当作完整成功。
- [并发同步覆盖全局状态] -> D1 单行租约、owner `run_id` CAS 和 `QUANT_SYNC_IN_PROGRESS`；总时限到达时只让当前 owner 收口。
- [快照无限增长] -> 每次有效快照写入后保留最近 30 个并清理更旧行；rejected run 不产生快照。
- [Gateway 共享路由回归] -> 先对 `fetch` 做 GitNexus impact，补 `/quant` 路由单测并验证既有路径。
- [D1 migration 影响启动] -> schema、migration、migration test、local D1 apply 和 API type-check 按顺序执行。
- [Worker 执行时间] -> v1 限制观察池、并发和总时限；后续再评估异步 runner，不在本 change 偷渡独立 Worker。
- [生产 Pages 尚无明确资源] -> 仅添加可配置 `QUANT_ORIGIN` 边界和本地入口，不修改 tracked production profile，避免部署到虚构项目。

## Migration Plan

1. 生成并测试 D1 migration，应用到本地 D1。
2. 实现 API/provider/factor 与 mock 测试。
3. 实现同步并发上限、总时限、全局状态租约/CAS、快照保留和相应迁移/测试。
4. 实现 Gateway `/quant` 与本地 3004 编排。
5. 实现 quant app，启动可重复 Tushare fixture，运行 Gateway 浏览器流程和 D1 authoritative readback。
6. 生产 Pages project、target profile、workflow 和 secret 在资源确认后单独变更。

## Open Questions

无。生产 Pages 身份被明确排除在本 change 外，不影响 v1 本地可用链路。

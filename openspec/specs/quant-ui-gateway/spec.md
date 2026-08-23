# quant-ui-gateway Specification

## Purpose
定义独立量化前端、本地 Gateway 代理和管理员访问链路。

## Requirements

### Requirement: 独立应用与本地入口

系统 MUST 新增 `apps/quant-app`，本地开发端口 MUST 为 `3004`；监听 `8080` 的 Gateway 的 quant 本地上游 MUST 指向该端口。Gateway MUST 将 `/quant` 和 `/quant/*` 转发到该应用，且不占用现有 Blog `3002`。

#### Scenario: Gateway 访问

- **WHEN** 访问 `http://localhost:8080/quant`
- **THEN** Gateway 规范化到 `/quant/`
- **AND** 已通过管理员鉴权后转发到 quant app

#### Scenario: 未登录访问

- **WHEN** 未登录访问 `http://localhost:8080/quant/`
- **THEN** Gateway 返回登录跳转
- **AND** quant app 不接收该请求

### Requirement: 工作台流程

quant app MUST 提供观察池管理、能力状态、同步控制、候选快照和指定股票日线展示。缺少能力的入口 MUST 显示不可用状态和原因，不发起未授权 provider 请求。

#### Scenario: v1 主流程

- **WHEN** 管理员加入观察项并点击同步
- **THEN** 页面显示同步状态、候选结果和日线数据
- **AND** 页面显示当前为 120 积分时 `daily_basic` 等能力不可用

#### Scenario: 可重复 fixture 的成功主流程

- **WHEN** 测试环境将 API 的 `TUSHARE_BASE_URL` 指向固定本地 fixture，管理员从 `http://localhost:8080/quant/` 加入观察项并点击同步
- **THEN** 页面显示 `completed`、写入数量、候选快照和日线结果
- **AND** API 返回的 `snapshotId` 与页面展示的快照一致，D1 `quant_daily_bar`、`quant_scan_snapshot`、`quant_sync_state` 权威读回包含同一代码、日期范围、候选计数和状态
- **AND** 重复同步保持日线唯一键数量不变，证明成功流程同时覆盖幂等写入

### Requirement: Gateway 回归

新增 `/quant` 路由 MUST 保持 `/dashboard`、`/blog`、`/movie`、`/comic`、`/auth` 和 `/api` 现有路由行为不变。

#### Scenario: 既有路由回归

- **WHEN** 运行 Gateway 路由测试
- **THEN** 既有路径的目标、鉴权和重写断言继续通过

### Requirement: Production Quant origin provisioning

Tracked deployment targets MUST declare a valid Quant frontend origin. Target-aware Gateway Wrangler configuration MUST emit `QUANT_ORIGIN` from that origin, and production `/quant/*` requests MUST proxy to it after stripping the `/quant` prefix.

#### Scenario: Configured production Quant origin

- **WHEN** the selected target has a deployed Quant origin
- **THEN** generated Gateway configuration contains `QUANT_ORIGIN` with that HTTPS origin
- **AND** `https://<gateway>/quant/` reaches the Quant frontend through the Gateway

#### Scenario: Missing production Quant origin

- **WHEN** a target profile does not declare a Quant origin
- **THEN** target-aware configuration generation fails closed before deployment
- **AND** Gateway does not silently fall back to another Pages application

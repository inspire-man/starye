## Purpose

让 Quant 工作台的同步状态与已持久化的同步事实保持一致，避免重载后把已有日线数据误显示为未更新。

## ADDED Requirements

### Requirement: Restore persisted sync state

Quant 工作台 MUST 在加载观察池和候选数据时读取现有 `GET /api/quant/sync`，并在更新数据卡片中显示最近一次同步的状态、完成时间、请求数、写入数和跳过数。该读取 MUST 只使用现有 GET 接口，不触发同步写入。

#### Scenario: Completed state survives a reload

- **WHEN** `/api/quant/sync` 返回 `completed` 及其完成时间和计数
- **THEN** 页面显示已完成状态和持久化计数
- **AND** 页面不显示“尚未更新日线数据”
- **AND** 页面不发起 POST `/api/quant/sync`

#### Scenario: No persisted state

- **WHEN** `/api/quant/sync` 返回 `data: null`
- **THEN** 页面显示尚未更新日线数据
- **AND** 页面仍允许用户手动更新观察池

### Requirement: Keep sync state failures honest

同步状态读取 MUST 独立于观察池和候选请求呈现加载与失败状态。读取进行中 MUST 显示读取中；读取失败 MUST 显示可理解的错误，不得将失败降级为无历史记录。

#### Scenario: Sync state read fails

- **WHEN** `/api/quant/sync` 返回错误或网络失败
- **THEN** 更新数据卡片显示同步状态读取失败
- **AND** 页面不显示“尚未更新日线数据”作为失败原因
- **AND** 观察池、候选和其他已成功加载的数据保持可用

### Requirement: Prefer the current sync response

用户手动触发同步后，页面 MUST 使用当前 POST 响应立即显示本次结果；后续工作台刷新 MUST 重新从 GET 读取持久化状态。状态读取不得覆盖当前会话刚完成的同步结果，或触发额外的同步请求。

#### Scenario: Manual sync completes

- **WHEN** POST `/api/quant/sync` 返回 `completed`、`partial` 或 `rejected`
- **THEN** 页面显示对应状态和计数
- **AND** 页面随后刷新 watchlist、candidates、value-selection 和 shareholder-returns

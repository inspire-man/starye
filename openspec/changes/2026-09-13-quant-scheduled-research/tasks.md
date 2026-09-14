## 1. 持久化与选择

- [x] 1.1 新增用户作用域的 scheduled research run/item 表，并加入 D1 migration。完成标准：schema、SQL、journal 与 type-check 对齐。
- [x] 1.2 实现到期判断：已逾期、今日复查、日线过期/缺失、研究报告不足；跳过 paused/excluded。完成标准：定向单测覆盖日期与缺口边界。

## 2. Worker 调度

- [x] 2.1 在现有 Worker scheduled 中接入 Quant tick：每用户每 tick 最多 3 只，lease + cooldown，失败不影响爬虫清理。完成标准：handler 单测确认 waitUntil 调用。
- [x] 2.2 复用日线同步、确定性报告和可选 AI 摘要；ready 报告才推进 reviewDate。完成标准：编排单测覆盖成功、数据失败、AI 失败和跳过。

## 3. 读回与界面

- [x] 3.1 新增 GET /api/quant/research/schedule 契约、OpenAPI 与 Quant 客户端解析。完成标准：contract matrix 48 项对齐。
- [x] 3.2 Overview 展示最近一次后台任务状态和标的阶段，不出现买卖文案。完成标准：组件测试覆盖空状态和已完成状态。

## 4. 验证

- [x] 4.1 运行 OpenSpec strict、Quant/API 定向测试与 type-check。
- [x] 4.2 Gateway 验收：认证态 Overview 能读到任务，匿名 401/302。

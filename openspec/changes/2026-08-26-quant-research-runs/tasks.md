## 1. 规格与数据模型

- [x] 1.1 完成研究运行 proposal、design、spec 和 tasks；完成标准：OpenSpec planning status 完整且包含用户隔离、证据字段和 bridge 边界
- [x] 1.2 新增 `quant_research_run` Drizzle schema、relations、索引和 `0042` migration；完成标准：无明文 AI secret，user/ts_code/generated_at 索引存在
- [x] 1.3 补充 migration test，验证用户隔离、JSON 快照 readback、历史排序和同一股票跨用户独立

## 2. 报告与 API

- [x] 2.1 新增确定性 `research-report-v1` 纯函数；完成标准：趋势、估值、质量、股东回报、风险和数据缺口均有状态/阈值/来源/公式版本
- [x] 2.2 新增研究运行 repository；完成标准：创建后 authoritative readback，查询始终带当前 user id
- [x] 2.3 新增 POST/GET 研究运行 API、Valibot schema 和 route tests；完成标准：成功、观察池外代码、上游部分失败、匿名和用户隔离均覆盖
- [x] 2.4 复用现有 provider 错误与超时边界；完成标准：单项 provider 失败不会伪造通过或丢失其他证据

## 3. Quant 工作台

- [x] 3.1 扩展 Quant types/client 支持生成和历史研究运行；完成标准：响应 envelope、错误和历史排序有客户端测试
- [x] 3.2 在分析抽屉加入研究报告区；完成标准：生成、加载、失败、空状态和重复点击状态清晰
- [x] 3.3 完成桌面/390px 证据列表验证；完成标准：长来源、缺口、状态标签和按钮不重叠

## 4. 验证与收尾

- [x] 4.1 运行 API、DB、Gateway、Quant 前端定向测试、lint、type-check 和 build；完成标准：受影响检查通过
- [x] 4.2 运行 OpenSpec strict、GitNexus impact/detect_changes 和 `git diff --check`；完成标准：变更范围符合 Quant research run
- [x] 4.3 通过 Gateway 回归生成报告、历史读取、匿名入口和用户隔离；完成标准：API 响应与 D1 readback 一致

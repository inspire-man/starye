## 1. Knowledge Contract

- [x] 1.1 建立文章来源、因子假设、别名映射和数据状态的领域类型与静态目录，并用单元测试锁定 7 个来源、状态分类和核心别名
- [x] 1.2 增加受保护的 knowledge API 与客户端解析契约，并用路由/客户端测试验证来源、因子、缺口和别名字段

## 2. Watchlist Seed

- [x] 2.1 新增幂等 A 股观察池 migration，覆盖文章中明确的核心研究样本，并用内存 D1 重复 apply 和 readback 验证不重复、不覆盖用户编辑

## 3. Workbench

- [x] 3.1 在 Quant 工作台加载独立 knowledge 状态，并验证知识请求失败不清理技术、价值或财务数据
- [x] 3.2 展示 active/partial/planned 因子、数据缺口、文章来源和别名映射，并完成桌面与 390px 移动布局验收

## 4. Verification

- [x] 4.1 运行 OpenSpec 严格校验、数据库/API/Quant 测试、类型检查、lint、构建和 diff 检查
- [x] 4.2 运行 GitNexus staged detect_changes，并通过 Gateway 完成知识接口、观察池 readback 和浏览器验收

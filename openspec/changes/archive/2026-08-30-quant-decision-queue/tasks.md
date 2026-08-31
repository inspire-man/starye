## 1. 规格与 API

- [x] 1.1 建立 proposal、design 和 delta spec，冻结用户隔离、去重、上限和同日价格边界。
- [x] 1.2 增加 repository 最新决策队列查询和认证 GET 路由，复用现有响应解析。
- [x] 1.3 增加 API 集成测试，覆盖空队列、重复 run、limit、排序、用户隔离和损坏 snapshot。

## 2. Quant 前端

- [x] 2.1 增加 API client 队列读取、纯计算 helper 和边界单元测试。
- [x] 2.2 增加决策待办组件并接入 App 加载、刷新、局部错误和详情跳转。
- [x] 2.3 完成加载、空、错误、长文本和 390px 可访问布局测试。

## 3. 验收

- [x] 3.1 运行 API/Quant 定向测试、type-check、build、lint 和 OpenSpec strict。
- [x] 3.2 通过 Gateway 验证候选页、详情跳转、桌面/390px 溢出和浏览器错误；提交前运行 staged GitNexus detect_changes。

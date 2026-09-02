# Testing Strategy

测试按风险从局部到真实消费层递进：

1. 纯函数、解析器和组件状态使用 Vitest 与本地 fixture。
2. API、数据库和跨包契约使用定向集成测试。
3. 前端关键路径使用 Playwright，并从 Gateway 入口启动验证。
4. Crawler 或持久化变更补 D1 authoritative readback、内容完整性和实际读取/播放证据。
5. 生产行为使用新的 target/run/attempt tuple，不复用历史证明。

代码库的详细测试模式快照位于 ../.planning/codebase/TESTING.md；Movie 应用的运行说明位于 ../apps/movie-app/E2E-TEST-GUIDE.md。

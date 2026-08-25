## 1. 规格与影响

- [x] 1.1 完成 Gateway/Auth/本地启动链路复现，并记录旧 Gateway 命中 Blog 的证据。
- [x] 1.2 完成 GitNexus upstream impact，确认 Gateway `fetch`、本地监督器和 OAuth 规范化函数的影响范围。

## 2. 实现与测试

- [x] 2.1 在本地监督器启动子服务前检查固定端口；完成标准：占用端口时不调用 `startService`，返回失败并清理临时输入。
- [x] 2.2 将 Quant 3004 纳入端口清理和服务健康检查；完成标准：清理与健康输出均覆盖 Quant。
- [x] 2.3 补充本地监督器端口占用回归测试；完成标准：干净端口仍可 ready，预占端口不会杀掉既有进程。
- [x] 2.4 补充 Gateway `/quant/` 匿名路径和查询参数测试；完成标准：Location 始终为 `/auth/login`，next 始终为原始 Quant 路径。
- [x] 2.5 补充 Auth OAuth Quant 回跳规范化测试；完成标准：同源 Quant 路径保留，外部目标归一到 `/`。

## 3. 验证与收尾

- [x] 3.1 清理重复本地服务并启动单一服务栈；完成标准：8080 只有当前 Gateway 监听。
- [ ] 3.2 通过 Gateway、浏览器、聚焦测试、类型检查和构建验证；完成标准：未登录不进入 `/blog/quant/`，已登录 Quant 保持可用。当前 Gateway/Auth/本地启动器测试、Quant 类型检查和构建均通过；Auth Nuxt typecheck 仍受既有 `packages/config` `.ts` 扩展配置错误影响。
- [x] 3.3 运行 GitNexus detect_changes 和 OpenSpec strict validate；完成标准：只影响预期文件与流程，规格校验通过。

## 实现任务

- [x] 将 `quant` 加入 target Pages surface、tracked profile、Vite runtime/build path，并补齐类型和 profile 校验测试。完成标准：target profile 能解析 Quant Pages project，Quant build env 的 base path 为 `/quant/`。
- [x] 增加 Quant Pages redirect 模板和 target-profile build/output 映射。完成标准：redirect、build argv、失败清理和路径安全测试通过。
- [x] 新增 `.github/workflows/deploy-quant.yml`，接入 target resolver、prepared mutation、Pages build/deploy 和 always cleanup。完成标准：workflow contract 测试覆盖 push path、manual target、prepared project 和 secret 边界。
- [x] 执行 `pnpm --filter quant-app build`、相关 `@starye/config` 测试、根 lint/type-check、OpenSpec strict。完成标准：本地验证全部通过且无未追踪生成文件。
- [x] 提交、推送并观察 Quant workflow。完成标准：Actions 检查通过，失败时只修复本 change 引起的问题。

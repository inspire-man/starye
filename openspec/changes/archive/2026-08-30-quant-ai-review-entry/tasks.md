# 任务

## 1. 规格与影响

- [x] 1.1 建立 proposal、spec、design，明确事件桥接、复核状态和历史摘要边界。
- [x] 1.2 运行 GitNexus upstream impact，确认推荐卡与摘要生成流程的直接调用者。

## 2. 决策卡入口

- [x] 2.1 增加 AI 复核事件和进行中 prop，覆盖无摘要、旧摘要和 accepted 摘要状态。
- [x] 2.2 在 `App.vue` 绑定现有摘要生成函数，复用 loading/generating 状态并禁止重复触发。
- [x] 2.3 补充组件测试和 390px/键盘可达验证。

## 3. 验证与交付

- [x] 3.1 运行 Quant 测试、type-check、lint、build、OpenSpec strict。
- [x] 3.2 通过 Gateway 检查决策卡入口和 AI 状态。
- [x] 3.3 运行 staged GitNexus detect_changes，确认只影响推荐卡流程并提交代码。

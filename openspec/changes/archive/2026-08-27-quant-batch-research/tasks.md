## 1. Batch orchestration

- [x] 1.1 新增有界并发的研究批量编排器，限制最多 3 个候选和最多 2 个并发 runner，并验证输入顺序和逐项进度回调
- [x] 1.2 为编排器补充 Vitest，覆盖成功、单项失败继续执行、并发上限和稳定结果归属

## 2. Quant comparison workflow

- [x] 2.1 在候选对比抽屉加入批量研究入口，选择不足时保持禁用，运行时阻止重复触发
- [x] 2.2 在对比抽屉展示每只候选的排队、进行中、成功和失败状态，并显示真实研究状态/动作与批次计数
- [x] 2.3 支持批量完成后的再次触发，保留旧研究历史且不改变候选选择、评分或对比数据

## 3. Responsive presentation and verification

- [x] 3.1 增加批量研究面板的状态样式、键盘焦点和窄屏布局，验证长股票名称与错误信息不溢出
- [x] 3.2 运行 Quant 定向测试、type-check、lint、build、OpenSpec strict 和 `git diff --check`
- [x] 3.3 运行 GitNexus detect_changes，并经 `http://localhost:8080/quant/` 验证选择不足、成功、部分失败和再次触发状态

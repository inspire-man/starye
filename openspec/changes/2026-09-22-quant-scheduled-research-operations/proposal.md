# Quant 后台研究运营闭环

## 背景

Quant 已能在 Worker 定时任务中处理逾期复查、日线过期和研究数据不足，并在 Overview 展示最近一次运行。当前用户只能看到最近一次结果，无法从页面查看历史运行，也无法主动触发一次有界的后台批次。

## 目标

- 提供用户作用域的后台研究运行历史。
- 提供一个受认证保护的“立即运行一批”入口，复用现有 lease、cooldown 和每批 3 项上限。
- Overview 展示历史运行摘要并支持手动触发，保留数据、研究和 AI 阶段边界。

## 非目标

- 不改变到期原因、复查日推进规则、研究报告公式或 AI 纳入规则。
- 不新增买卖建议、信号排序或自动交易行为。
- 不绕过 Worker 的租约、冷却和用户隔离。

## 影响与风险

涉及 API research handler、scheduled research store/runtime、Quant research client、Overview 组件和对应测试。主要风险是手动触发重复运行和跨用户读写；实现必须继续使用用户 session、D1 用户条件和现有 lease/cooldown。


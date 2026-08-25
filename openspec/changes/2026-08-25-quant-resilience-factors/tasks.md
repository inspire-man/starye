## 1. Formula

- [x] 1.1 扩展 `value-quality-v2` 公式、增长现金流连续性和韧性维度，并验证分值上限、缺失字段和风险扣分边界
- [x] 1.2 补充财务质量单元测试，覆盖韧性指标方向、两期现金流比例和绝对门槛触发

## 2. Knowledge And Contract

- [x] 2.1 将逆境韧性知识因子接入 `resilience` 维度并验证 `/api/quant/knowledge` 响应
- [x] 2.2 扩展 Quant client 类型、parser 和 API 集成测试，验证 `value-quality-v2` 与 `resilience` 维度解析

## 3. Workbench

- [x] 3.1 更新工作台公式说明、维度标签和风险提示展示，验证缺失状态与 390px 布局
- [x] 3.2 运行 API/Quant/UI 类型检查、聚焦测试、构建、OpenSpec strict 和 GitNexus detect_changes

## 背景

Quant 已经能为单只股票生成确定性研究报告，也能按需生成单股 AI 证据解读；但候选对比抽屉目前只有并排数值表，用户仍需自己把多只股票的共同点、差异和风险拼接起来。这样 AI 的结果没有出现在候选比较这一条核心工作流中，接入后的感知很弱。

## 目标

- 在候选对比抽屉中增加用户主动触发的 AI 对比研究助手。
- 基于当前用户已完成的 2 至 3 份研究报告，生成共同点、逐股差异、风险和下一步核对项。
- 每条 AI 结论保留 `tsCode + evidenceKey` 引用，允许用户回到对应股票详情核对原始证据。
- AI 配置缺失、研究报告不完整或上游失败时，显示明确状态，不伪造成功结论。

## 非目标

- 不改变确定性评分、候选排序、研究动作、研究标记或交易判断。
- 不把前端提交的报告正文直接转发给模型；服务端重新读取当前用户拥有的研究运行。
- 不新增 D1 表、AI provider、API key 传输、自动触发、流式输出或聊天上下文。
- 不替代现有单股 AI 摘要；单股摘要仍可独立生成和查看。

## 影响

- `apps/api/src/domain/quant/ai-comparison.ts`：新增对比 prompt、响应校验和错误分类。
- `apps/api/src/schemas/quant.ts`、`apps/api/src/routes/quant/index.ts`：新增认证对比助手接口和请求/响应契约。
- `apps/api/src/routes/quant/__tests__/crud.integration.test.ts`、`apps/api/src/domain/quant/__tests__/ai-comparison.test.ts`：覆盖用户隔离、证据引用、配置缺失和无效响应。
- `apps/quant-app/src/lib/api-client.ts`、`apps/quant-app/src/lib/quant-types.ts`：增加对比助手响应解析与调用。
- `apps/quant-app/src/App.vue`、`apps/quant-app/src/style.css`：在候选对比抽屉展示触发按钮、状态、结果和证据入口。
- 仅改变 Quant API 与前端，不修改数据库 schema；API/Quant 部署均需验证。

## 风险

- 多份报告可能来自不同日期或不同数据覆盖，prompt 和界面必须明确“仅基于当前报告事实”，不强行得出投资优劣结论。
- 模型可能返回不存在或跨股票混淆的证据 Key，服务端必须按股票代码校验引用白名单。
- 对比内容可能较长；响应字段和数组数量需要有界，页面在 390px 下必须可读且不横向溢出。

## 可验证需求

- 用户主动点击后，Quant MUST 只对当前用户已完成的 2 至 3 份研究运行生成一次对比分析，并返回共同点、差异、风险、下一步和合法证据引用。
- AI 失败或返回非法引用时，Quant MUST 显示诚实失败状态，且不得修改或持久化确定性研究报告。

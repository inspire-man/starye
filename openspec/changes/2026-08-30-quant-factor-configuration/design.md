# 设计

## 数据模型

新增 `quant_factor_config`：

- `id`：主键。
- `user_id`：唯一、非空、级联删除，绑定 Better Auth 用户。
- `version`：`research-factor-config-v1`。
- `weights_json`：包含五个因子 key 的标准化小数权重。
- `created_at`、`updated_at`：D1 时间戳。

没有配置行时，服务返回内置默认配置；首次保存再创建用户行。删除配置行表示恢复默认，不删除历史研究报告。

## 领域契约

`factor-configuration.ts` 集中定义因子 key、默认权重、有限数和总和校验。`decision-recommendation.ts` 接受可选的 `factorConfiguration`：未传入时使用默认配置，传入时使用已验证配置。因子模型包含可选 `configuration` 快照，旧报告缺少该字段时仍然有效。

配置总和使用小误差容忍进行校验，保存和输出统一保留 4 位小数。权重为 0 的因子不计入有效评分权重和完整数据阻断，但仍保留在因子列表中用于来源审计。

## API

- `GET /api/quant/factor-config`：返回当前用户配置；无持久化行时 `source=default`、`updatedAt=null`。
- `PUT /api/quant/factor-config`：接受 `{ weights: { trend, valuation, quality, shareholder-return, risk } }`，成功后返回 D1 读回的 `source=user` 配置。
- `DELETE /api/quant/factor-config`：删除当前用户配置并返回默认配置。

请求字段使用 camelCase；报告 JSON 同时沿用当前 camelCase 序列化约定。所有端点复用 Quant 认证和错误包络。

## 报告流程

生成研究报告时，路由先读取当前用户因子配置，再并行读取外部 provider；provider 结果和配置一起传入报告构建器。`factorModel.configuration` 与 `factorModel.factors[].weight` 必须来自同一对象。历史报告解析器对缺失配置字段采用旧格式兼容路径。

## 前端

Quant header 保留 AI 配置按钮，新增因子设置按钮。配置抽屉加载当前配置，使用百分比数字输入和滑块编辑五项权重，只有总和为 100% 且请求未进行时允许保存；恢复默认调用 DELETE。详情决策区域增加“配置来源/版本”提示，因子行继续展示权重、真实 provider 来源和状态。

配置更新不会偷偷重算已有报告；用户需要点击“重新生成”获得带新快照的报告。

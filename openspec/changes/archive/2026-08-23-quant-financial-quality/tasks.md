## 1. OpenSpec and provider

- [x] 1.1 完成 `quant-financial-quality` proposal、spec、design，并通过 OpenSpec strict 校验
- [x] 1.2 增加 Eastmoney 财务质量 provider、字段标准化和超时/坏响应处理；provider 单测覆盖成功、nullable、空 data、坏 JSON、超时及 SH/SZ/BJ 映射

## 2. API contract

- [x] 2.1 增加财务质量响应 schema、`GET /api/quant/financial/:tsCode` 路由及认证/错误映射；路由测试覆盖未认证、成功和上游失败
- [x] 2.2 增加 Quant client 类型、snake_case 解析和 `getFinancialQuality`；客户端测试覆盖完整字段与缺失字段

## 3. Selection workbench

- [x] 3.1 在选中股票视图增加基本面速览、报告元数据、初学者友好标签和数据免责声明；类型检查与构建通过
- [x] 3.2 将财务请求接入股票切换并隔离日线/估值错误；验证快速切换不会显示旧股票结果，财务失败时其他区域仍可用

## 4. Verification

- [x] 4.1 运行 API 定向/全量测试、Quant 测试、lint、type-check、build，全部通过
- [x] 4.2 通过 Gateway 验证 `/quant/` 桌面和 390px 移动端，切换紫金矿业、特变电工、中国海油并检查无横向溢出

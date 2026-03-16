# Spec: R18 Whitelist Management

## ADDED Requirements

### Requirement: 管理员可以查看白名单用户列表

系统 SHALL 在 Dashboard 中提供白名单管理界面，展示所有已授权的 R18 用户。

#### Scenario: 访问白名单管理页面
- **WHEN** 管理员（super_admin 或 admin）访问 Dashboard 的"R18 白名单"页面
- **THEN** 系统显示所有 `isR18Verified = true` 的用户列表

#### Scenario: 显示用户详情
- **WHEN** 白名单列表显示用户
- **THEN** 每个用户显示：GitHub 用户名、邮箱、授权时间、授权管理员

#### Scenario: 非管理员无法访问
- **WHEN** 非管理员用户尝试访问白名单管理页面
- **THEN** 系统返回 403 错误

### Requirement: 管理员可以添加用户到白名单

系统 SHALL 允许管理员通过用户 ID 或邮箱将用户添加到 R18 白名单。

#### Scenario: 通过邮箱添加用户
- **WHEN** 管理员输入用户邮箱并点击"添加"
- **THEN** 系统查找该邮箱对应的用户，并设置 `isR18Verified = true`

#### Scenario: 通过用户ID添加用户
- **WHEN** 管理员输入用户 ID 并点击"添加"
- **THEN** 系统设置该用户的 `isR18Verified = true`

#### Scenario: 添加不存在的用户
- **WHEN** 管理员输入的邮箱或 ID 不存在
- **THEN** 系统显示错误提示"用户不存在"

#### Scenario: 添加已在白名单的用户
- **WHEN** 管理员尝试添加已在白名单的用户
- **THEN** 系统显示提示"该用户已在白名单中"

#### Scenario: 记录授权操作
- **WHEN** 管理员成功添加用户到白名单
- **THEN** 系统在 audit_logs 表中记录操作（操作类型：ADD_R18_WHITELIST）

### Requirement: 管理员可以移除白名单用户

系统 SHALL 允许管理员将用户从 R18 白名单中移除。

#### Scenario: 移除白名单用户
- **WHEN** 管理员在白名单列表中点击某用户的"移除"按钮
- **THEN** 系统设置该用户的 `isR18Verified = false`

#### Scenario: 二次确认
- **WHEN** 管理员点击"移除"按钮
- **THEN** 系统弹出确认对话框"确定要移除该用户的 R18 访问权限吗？"

#### Scenario: 记录移除操作
- **WHEN** 管理员成功移除用户
- **THEN** 系统在 audit_logs 表中记录操作（操作类型：REMOVE_R18_WHITELIST）

#### Scenario: 移除后用户立即失去访问权限
- **WHEN** 用户被移除白名单
- **THEN** 系统在用户下次请求 R18 内容时返回 403 错误

### Requirement: 前端应用验证用户R18权限

系统 SHALL 在前端应用中检查用户的 R18 验证状态。

#### Scenario: 前端路由守卫
- **WHEN** 用户尝试访问 R18 漫画或影片详情页
- **THEN** 系统检查 `user.isR18Verified`，如为 false，则显示权限不足提示

#### Scenario: 列表页内容过滤
- **WHEN** 前端应用渲染内容列表
- **THEN** 系统根据 `user.isR18Verified` 决定是否显示 R18 内容

#### Scenario: 详情页模糊显示
- **WHEN** 未认证用户访问 R18 内容详情页
- **THEN** 系统显示模糊封面和锁图标，点击后提示"需要管理员授权"

### Requirement: API层强制验证R18权限

系统 SHALL 在 API 层面强制验证用户的 R18 权限。

#### Scenario: 中间件验证
- **WHEN** 用户请求 R18 内容的 API（如 `/api/public/comics/:slug`）
- **THEN** 系统检查 `user.isR18Verified`，如为 false 且内容为 R18，则返回 403

#### Scenario: 数据库查询过滤
- **WHEN** API 查询内容列表
- **THEN** 系统在 SQL 查询中添加过滤条件：`WHERE isR18 = false OR user.isR18Verified = true`

#### Scenario: 详情API验证
- **WHEN** 用户请求特定内容详情（如 `/api/public/movies/ABF-326`）
- **THEN** 系统检查该内容的 `isR18` 字段，如为 true 且用户未认证，则返回 403

### Requirement: 数据库支持R18白名单字段

系统 SHALL 在 user 表中添加 R18 验证状态字段。

#### Scenario: 新用户默认未认证
- **WHEN** 用户首次通过 GitHub OAuth2 登录
- **THEN** 系统创建用户记录时，`isR18Verified` 默认为 false

#### Scenario: 白名单状态查询高效
- **WHEN** 系统需要验证用户 R18 权限
- **THEN** 系统通过索引快速查询 `user.isR18Verified` 字段（性能要求：< 10ms）

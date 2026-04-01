# Spec: Aria2 RPC 连接管理

## ADDED Requirements

### Requirement: 用户可以配置 Aria2 RPC 连接

系统 SHALL 允许用户在个人中心配置 Aria2 RPC 连接参数，包括 RPC 地址、密钥（可选）和连接选项 MUST。

#### Scenario: 首次配置 Aria2 连接
- **WHEN** 用户首次访问 Aria2 设置页面
- **THEN** 系统显示配置表单，包含 RPC URL 输入框、密钥输入框和测试连接按钮

#### Scenario: 保存有效的 Aria2 配置
- **WHEN** 用户填写正确的 RPC 地址（如 `http://localhost:6800/jsonrpc`）并点击保存
- **THEN** 系统验证连接、保存配置到 localStorage 和后端（如已登录），并显示"配置已保存"

#### Scenario: 配置无效的 RPC 地址
- **WHEN** 用户输入无效的 URL 或无法连接的地址
- **THEN** 系统显示错误提示"无法连接到 Aria2，请检查地址和服务状态"

### Requirement: 系统自动检测 Aria2 连接状态

系统 MUST 持续监控 Aria2 连接状态，并在状态变化时通知用户。

#### Scenario: 连接成功
- **WHEN** Aria2 RPC 服务可访问且认证成功
- **THEN** 系统显示绿色"已连接"状态指示器，启用所有 Aria2 相关功能

#### Scenario: 连接断开
- **WHEN** Aria2 RPC 服务不可访问或认证失败
- **THEN** 系统显示红色"未连接"状态指示器，禁用 Aria2 功能，并提示用户检查配置

#### Scenario: 连接恢复
- **WHEN** 断开的连接重新可用
- **THEN** 系统自动重连并显示"连接已恢复"通知

### Requirement: 支持 Secret Token 认证

系统 SHALL 支持 Aria2 的 Secret Token 认证机制 MUST。

#### Scenario: 使用密钥认证
- **WHEN** 用户配置了 Secret Token 并发起 RPC 调用
- **THEN** 系统在每个请求中包含 `token:` 前缀的密钥参数

#### Scenario: 密钥错误
- **WHEN** 提供的密钥不正确
- **THEN** 系统返回认证失败错误，提示用户检查密钥

### Requirement: 配置数据持久化

系统 MUST 将 Aria2 配置数据持久化存储。

#### Scenario: 未登录用户的配置存储
- **WHEN** 未登录用户保存 Aria2 配置
- **THEN** 系统将配置保存到 localStorage，仅在当前浏览器可用

#### Scenario: 已登录用户的配置存储
- **WHEN** 已登录用户保存 Aria2 配置
- **THEN** 系统同时保存到 localStorage 和后端数据库，支持跨设备访问

#### Scenario: 配置同步
- **WHEN** 已登录用户在新设备首次访问
- **THEN** 系统从后端加载配置并同步到本地

### Requirement: 连接安全性

系统 SHALL 确保 Aria2 RPC 连接的安全性 MUST。

#### Scenario: HTTPS 环境下的配置
- **WHEN** 网站运行在 HTTPS 环境
- **THEN** 系统允许配置 HTTP 或 HTTPS 的 Aria2 地址

#### Scenario: 密钥加密存储
- **WHEN** 用户保存包含密钥的配置到后端
- **THEN** 系统加密存储密钥，不以明文形式存储

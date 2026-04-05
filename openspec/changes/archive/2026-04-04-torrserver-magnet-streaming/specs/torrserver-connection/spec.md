## ADDED Requirements

### Requirement: TorrServer 连接配置持久化
系统 SHALL 允许用户在个人中心配置 TorrServer 服务地址，配置 MUST 持久化到 localStorage，格式与 Aria2 配置模式一致。

#### Scenario: 首次配置 TorrServer 地址
- **WHEN** 用户在个人中心 TorrServer 设置 tab 输入服务地址（如 `http://localhost:8090`）并点击保存
- **THEN** 系统将配置写入 localStorage key `torrserver-config`，并显示保存成功提示

#### Scenario: 页面刷新后恢复配置
- **WHEN** 用户刷新页面或重新打开应用
- **THEN** `useTorrServer` composable 初始化时从 localStorage 读取已保存的配置，恢复 `serverUrl` 状态

### Requirement: TorrServer 连接状态检测
系统 MUST 提供连接测试功能，通过调用 TorrServer `GET /echo` 端点验证服务可达性和版本信息。

#### Scenario: 连接测试成功
- **WHEN** 用户点击「测试连接」按钮，且 TorrServer 服务正常运行
- **THEN** 系统调用 `GET /echo`，解析返回的版本号，将 `isConnected` 设为 `true`，显示 "已连接到 TorrServer vX.X.X" 成功提示

#### Scenario: 连接测试失败 — 服务不可达
- **WHEN** 用户点击「测试连接」按钮，但 TorrServer 未启动或地址错误
- **THEN** 系统在超时（10 秒）后将 `isConnected` 设为 `false`，显示 "连接失败: 请检查 TorrServer 是否已启动" 错误提示

#### Scenario: 连接测试失败 — CORS 被阻止
- **WHEN** 浏览器因 CORS 策略阻止请求
- **THEN** 系统显示 "连接被浏览器安全策略阻止，请确保 TorrServer 已启用 CORS（启动参数 --cors）" 错误提示

### Requirement: TorrServer 设置 UI 组件
系统 MUST 在个人中心提供独立的 TorrServer 设置 tab，包含服务地址输入、连接测试按钮和连接状态显示。

#### Scenario: 个人中心展示 TorrServer 设置 tab
- **WHEN** 用户访问个人中心页面
- **THEN** tab 列表中 MUST 包含「🎬 TorrServer」选项，点击后展示 `TorrServerSettings` 组件

#### Scenario: 设置页面布局
- **WHEN** 用户切换到 TorrServer 设置 tab
- **THEN** 页面展示：服务地址输入框（默认值 `http://localhost:8090`）、测试连接按钮、连接状态指示器（已连接/未连接）、版本号（已连接时显示）

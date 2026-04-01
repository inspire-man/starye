# error-handling-ui Specification

## Purpose
提供统一的错误处理 UI 组件和机制，为用户提供友好的错误展示和操作建议。

## ADDED Requirements

### Requirement: System SHALL display user-friendly error messages

系统 **SHALL** 将技术错误转换为用户友好的错误消息。

#### Scenario: Network error
- **WHEN** API 请求因网络问题失败（如断网）
- **THEN** 系统显示"网络连接失败，请检查网络设置后重试"

#### Scenario: 403 Permission error
- **WHEN** API 返回 403 权限错误
- **THEN** 系统显示"您没有权限执行此操作，请联系管理员"

#### Scenario: 404 Not found error
- **WHEN** API 返回 404 资源不存在
- **THEN** 系统显示"请求的资源不存在，可能已被删除"

#### Scenario: 500 Server error
- **WHEN** API 返回 500 服务器错误
- **THEN** 系统显示"服务器错误，请稍后重试或联系技术支持"

#### Scenario: Validation error
- **WHEN** API 返回 400 验证错误，包含字段错误信息
- **THEN** 系统显示"数据验证失败"，并列出具体字段错误

### Requirement: ErrorDisplay SHALL provide actionable suggestions

`ErrorDisplay` 组件 **SHALL** 为错误提供可执行的操作建议。

#### Scenario: Retry button for network error
- **WHEN** 显示网络错误
- **THEN** ErrorDisplay 显示"重试"按钮，点击后重新执行失败的操作

#### Scenario: Go back button for 404
- **WHEN** 显示 404 错误
- **THEN** ErrorDisplay 显示"返回列表"按钮，点击后导航到列表页

#### Scenario: Contact support for 500
- **WHEN** 显示 500 服务器错误
- **THEN** ErrorDisplay 显示"联系支持"按钮，点击后打开反馈表单

#### Scenario: No action for permission error
- **WHEN** 显示 403 权限错误
- **THEN** ErrorDisplay 只显示错误消息，不提供操作按钮（用户无法自行解决）

### Requirement: useErrorHandler SHALL centralize error handling logic

`useErrorHandler` composable **SHALL** 集中处理所有错误逻辑。

#### Scenario: Handle API error
- **WHEN** 组件调用 `const { handleError } = useErrorHandler()` 并传入 API 错误
- **THEN** composable 自动识别错误类型，显示相应 Toast，并记录错误日志

#### Scenario: Custom error message
- **WHEN** 组件调用 `handleError(error, { message: '自定义错误提示' })`
- **THEN** 系统显示自定义消息而非默认错误消息

#### Scenario: Silent error handling
- **WHEN** 组件调用 `handleError(error, { silent: true })`
- **THEN** 系统记录错误日志，但不显示 Toast

#### Scenario: Error with retry callback
- **WHEN** 组件调用 `handleError(error, { onRetry: () => fetchData() })`
- **THEN** 系统显示 Toast 和重试按钮，点击后执行 callback

### Requirement: System SHALL catch global errors

系统 **SHALL** 捕获全局未处理的错误。

#### Scenario: Vue component error
- **WHEN** Vue 组件内部抛出未捕获的错误
- **THEN** 全局错误处理器捕获错误，显示 ErrorDisplay，阻止白屏

#### Scenario: Async error
- **WHEN** 异步操作（Promise）抛出未捕获的错误
- **THEN** `window.onunhandledrejection` 捕获错误，显示错误提示

#### Scenario: Error boundary fallback
- **WHEN** 错误无法被组件恢复
- **THEN** 显示错误页面，包含"刷新页面"按钮和错误报告选项

### Requirement: ErrorDisplay SHALL support different display modes

`ErrorDisplay` 组件 **SHALL** 支持多种展示模式。

#### Scenario: Inline error display
- **WHEN** 表单字段验证失败
- **THEN** 在字段下方显示红色错误文字（inline 模式）

#### Scenario: Banner error display
- **WHEN** 页面级错误（如列表加载失败）
- **THEN** 在页面顶部显示警告条（banner 模式）

#### Scenario: Modal error display
- **WHEN** 关键操作失败（如支付、删除）
- **THEN** 显示错误对话框（modal 模式），需用户确认后关闭

#### Scenario: Toast error display
- **WHEN** 一般操作失败（如保存草稿）
- **THEN** 显示错误 Toast（toast 模式，自动消失）

### Requirement: System SHALL log errors for debugging

系统 **SHALL** 记录错误信息以便调试。

#### Scenario: Console error log
- **WHEN** 发生任何错误
- **THEN** 在控制台输出完整错误堆栈和上下文信息

#### Scenario: Error metadata
- **WHEN** 记录错误
- **THEN** 包含：时间戳、用户 ID、页面 URL、错误类型、错误消息、堆栈跟踪

#### Scenario: Error reporting (future)
- **WHEN** 生产环境发生错误
- **THEN** 系统自动发送错误报告到监控服务（未来实现）

### Requirement: Error messages SHALL be i18n compatible

错误消息 **SHALL** 支持国际化。

#### Scenario: Chinese error message
- **WHEN** 用户语言设置为中文
- **THEN** 所有错误消息显示为中文

#### Scenario: English error message
- **WHEN** 用户语言设置为英文
- **THEN** 所有错误消息显示为英文

#### Scenario: Fallback message
- **WHEN** 错误消息没有对应的翻译
- **THEN** 显示英文默认消息

### Requirement: ErrorDisplay SHALL be accessible

`ErrorDisplay` 组件 **SHALL** 符合无障碍访问标准。

#### Scenario: ARIA role
- **WHEN** 显示错误
- **THEN** ErrorDisplay 使用 `role="alert"` 属性

#### Scenario: Screen reader announcement
- **WHEN** 错误出现
- **THEN** 屏幕阅读器自动朗读错误消息

#### Scenario: Focus management
- **WHEN** Modal 错误显示
- **THEN** 焦点自动移动到错误对话框的关闭按钮

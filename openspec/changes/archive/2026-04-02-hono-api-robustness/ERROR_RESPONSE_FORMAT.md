# API 错误响应格式变更通知

## 变更概述

为提升 API 错误处理的一致性和可追踪性，我们统一了错误响应格式。

## 新的错误响应格式

所有 API 错误响应现在遵循以下结构：

```typescript
interface ErrorResponse {
  success: false
  error: string              // 人类可读的错误消息
  code?: string              // 错误代码（见下方列表）
  details?: unknown          // 额外的错误详情（如验证错误）
  requestId?: string         // 请求追踪 ID
  timestamp: string          // ISO 8601 时间戳
}
```

## 错误代码列表

```typescript
enum ErrorCode {
  // 认证相关
  UNAUTHORIZED = 'UNAUTHORIZED'
  FORBIDDEN = 'FORBIDDEN'
  AUTH_ERROR = 'AUTH_ERROR'
  
  // 请求相关
  VALIDATION_ERROR = 'VALIDATION_ERROR'
  NOT_FOUND = 'NOT_FOUND'
  BAD_REQUEST = 'BAD_REQUEST'
  
  // 数据库相关
  DATABASE_ERROR = 'DATABASE_ERROR'
  UNIQUE_VIOLATION = 'UNIQUE_VIOLATION'
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION'
  NOT_NULL_VIOLATION = 'NOT_NULL_VIOLATION'
  
  // 服务器相关
  INTERNAL_ERROR = 'INTERNAL_ERROR'
  TIMEOUT = 'TIMEOUT'
}
```

## 错误响应示例

### 1. 验证错误 (400)

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email format",
      "received": "not-an-email"
    }
  ],
  "requestId": "req_abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. 认证错误 (401)

```json
{
  "success": false,
  "error": "Unauthorized: Please login first",
  "code": "UNAUTHORIZED",
  "requestId": "req_abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. 资源不存在 (404)

```json
{
  "success": false,
  "error": "Resource not found",
  "code": "NOT_FOUND",
  "requestId": "req_abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. 数据库约束错误 (400)

```json
{
  "success": false,
  "error": "Email already exists",
  "code": "UNIQUE_VIOLATION",
  "details": {
    "constraint": "users_email_unique",
    "field": "email"
  },
  "requestId": "req_abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. 内部服务器错误 (500)

```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "requestId": "req_abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 前端适配建议

### 1. 更新错误处理逻辑

```typescript
// 旧版本
axios.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.message || '请求失败'
    showError(message)
  }
)

// 新版本
axios.interceptors.response.use(
  response => response,
  error => {
    const errorData = error.response?.data
    
    if (errorData?.success === false) {
      // 使用结构化错误信息
      showError(errorData.error)
      
      // 可选：根据错误码做特殊处理
      if (errorData.code === 'UNAUTHORIZED') {
        router.push('/login')
      }
      
      // 可选：在控制台输出 requestId 用于排查
      console.error(`Error [${errorData.requestId}]:`, errorData)
    }
  }
)
```

### 2. 显示验证错误详情

```typescript
if (errorData.code === 'VALIDATION_ERROR' && errorData.details) {
  const details = errorData.details as ValidationErrorDetail[]
  
  details.forEach(error => {
    // 高亮表单字段
    const fieldName = error.path.join('.')
    highlightField(fieldName, error.message)
  })
}
```

### 3. 使用 requestId 进行错误追踪

```typescript
// 用户反馈问题时，请包含 requestId
function reportError(errorData: ErrorResponse) {
  sendToSupport({
    message: errorData.error,
    requestId: errorData.requestId,
    timestamp: errorData.timestamp,
    userAgent: navigator.userAgent,
  })
}
```

## 兼容性说明

- **向后兼容**: 原有的 `message` 字段映射到 `error` 字段
- **生效时间**: 2024-XX-XX 部署后立即生效
- **过渡期**: 建议在 2 周内完成前端适配

## 测试建议

1. 测试所有错误场景（401, 403, 404, 500 等）
2. 验证 `requestId` 在所有错误响应中存在
3. 验证验证错误的 `details` 结构正确
4. 测试错误消息的国际化（如需要）

## 联系方式

如有疑问，请联系后端团队。

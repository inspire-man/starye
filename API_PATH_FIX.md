# Dashboard API 路径修复

## 问题诊断

### 错误 URL
```
https://starye.org/api/api/admin/comics
                    ^^^^^^^^
                    重复的 /api
```

### 根本原因

在 `apps/dashboard/src/lib/api.ts` 中：

1. **API_BASE 已经包含 `/api`**：
   ```typescript
   export const API_BASE = '/api'
   ```

2. **fetchApi 函数会拼接 path**：
   ```typescript
   const url = `${API_BASE}${path}`
   ```

3. **但所有调用都传入了完整的 `/api/admin/...` 路径**：
   ```typescript
   getComics: () => fetchApi('/api/admin/comics')
   //                        ^^^^^^^^ 重复了！
   ```

4. **最终 URL 变成**：
   ```
   `/api` + `/api/admin/comics` = `/api/api/admin/comics` ❌
   ```

## 解决方案

移除所有 `fetchApi` 调用中的 `/api/` 前缀，因为 `API_BASE` 已经包含了。

### 修改前后对比

```diff
# fetchApi 调用
- getComics: () => fetchApi('/api/admin/comics')
+ getComics: () => fetchApi('/admin/comics')

- getUsers: () => fetchApi('/api/admin/users')
+ getUsers: () => fetchApi('/admin/users')

- fetchApi('/api/upload/presign')
+ fetchApi('/upload/presign')

# exportAuditLogs 中的 fetch 调用
- fetch(`${API_BASE}/api/admin/audit-logs/export`)
+ fetch(`${API_BASE}/admin/audit-logs/export`)
```

### 批量替换命令

```powershell
$file = "apps/dashboard/src/lib/api.ts"
(Get-Content $file -Raw) `
  -replace "fetchApi(<[^>]+>)?\(`'/api/", "fetchApi`$1('/" `
  | Set-Content $file
```

### 工作原理

1. **正则表达式**：`fetchApi(<[^>]+>)?\(`'/api/`
   - `fetchApi` - 匹配函数名
   - `(<[^>]+>)?` - 可选的泛型类型（如 `<Paginated<Comic>>`）
   - `\(` - 左括号
   - `'` - 单引号
   - `/api/` - 要移除的前缀

2. **替换为**：`fetchApi$1('/`
   - 保留 `fetchApi` 和泛型类型
   - 移除 `/api/` 前缀

## 正确的请求流程

### 浏览器端
```typescript
// 调用
api.admin.getComics()

// fetchApi 内部
const url = `${API_BASE}${path}`
// = '/api' + '/admin/comics'
// = '/api/admin/comics' ✅

// 浏览器发送请求
// GET https://starye.org/api/admin/comics
```

### Gateway 转发
```
浏览器：https://starye.org/api/admin/comics
  ↓
Gateway Worker（识别 /api 路径）
  ↓
API Worker：https://api.starye.org/admin/comics
```

## 验证修复

### 1. 检查代码
```powershell
# 应该没有任何匹配
Select-String -Path "apps/dashboard/src/lib/api.ts" -Pattern "'/api/"
```

### 2. 测试请求
```bash
# 浏览器控制台
fetch('/api/admin/comics')
  .then(r => r.json())
  .then(console.log)
```

### 3. 检查 Network 面板
- 请求 URL 应该是：`https://starye.org/api/admin/comics`
- 不应该是：`https://starye.org/api/api/admin/comics`

## 部署状态

- **构建**：✅ 成功
- **部署**：✅ 成功（部署 ID: `6513a0da`）
- **URL**：https://starye.org/dashboard/

## 测试清单

访问 https://starye.org/dashboard/ 并检查：

- [ ] 登录后能看到漫画库页面
- [ ] 漫画列表正常加载（无 404 错误）
- [ ] 用户管理页面正常
- [ ] 影视库页面正常
- [ ] 控制台无 `/api/api/` 的请求

## 总结

**根本问题**：API 路径重复

**修复方法**：移除 `fetchApi` 调用中的 `/api/` 前缀

**最终 URL 格式**：
- ✅ 正确：`https://starye.org/api/admin/comics`
- ❌ 错误：`https://starye.org/api/api/admin/comics`

所有 Dashboard API 请求现在都会正确路由到 API Worker！

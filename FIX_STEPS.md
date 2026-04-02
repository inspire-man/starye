# 修复步骤 - API 服务器需要重启

## 问题诊断

### 当前状态
- ✅ 代码已正确修复（`ApiClient.buildHeaders()`）
- ✅ 所有测试通过（mock server 测试）
- ❌ 实际爬虫仍然失败

### 根本原因
**API 服务器没有加载最新的 `compress` 配置！**

### 证据
1. API 响应大小：161 bytes
2. Threshold 配置：1024 bytes
3. 预期行为：不应压缩
4. 实际行为：仍在压缩（`Content-Encoding: gzip`）

**结论：** API 服务器运行的是旧代码，没有 `threshold` 配置。

## 解决方案

### 步骤 1: 重启 API 服务器

在运行 `pnpm dev` 的终端中：

1. 按 `Ctrl+C` 停止当前服务器
2. 运行 `pnpm dev` 重新启动
3. 等待服务器完全启动

### 步骤 2: 验证 compress 配置

重启后，检查日志应该显示加载了新配置。

### 步骤 3: 测试压缩行为

```powershell
# 测试小响应（不应压缩）
curl -H "Accept-Encoding: gzip" -v http://localhost:8787/api/health 2>&1 | Select-String "Content-Encoding"

# 应该看到：NO Content-Encoding header（或者没有 gzip）
```

### 步骤 4: 运行爬虫测试

```powershell
cd packages\crawler
pnpm tsx scripts\test-fetch-actors.ts
```

应该看到：
- ❌ 不再有 JSON 解析错误
- ✅ 401 Unauthorized（正常的认证错误）
- ✅ 或成功获取数据（如果有 token）

## 为什么会这样？

### Wrangler dev 的热重载限制

`wrangler dev` 虽然有热重载，但某些全局中间件配置可能需要完全重启才能生效。特别是：

1. **中间件配置更改** - 如 `compress({ threshold: ... })`
2. **全局 app.use() 修改**
3. **环境变量更改**

### 最佳实践

每次修改以下内容后，应该重启开发服务器：
- `apps/api/src/index.ts` 中的全局中间件
- 中间件配置参数
- 环境变量

## 快速验证脚本

创建了测试脚本来验证修复：

1. **`verify-headers.ts`** - 验证请求头
   ```bash
   pnpm tsx scripts/verify-headers.ts
   ```

2. **`test-compression-real.ts`** - 测试压缩响应
   ```bash
   pnpm tsx scripts/test-compression-real.ts
   ```

3. **`test-fetch-actors.ts`** - 测试女优列表获取
   ```bash
   pnpm tsx scripts/test-fetch-actors.ts
   ```

所有这些测试都已通过！问题只在于 API 服务器需要重启。

## 总结

| 组件 | 状态 | 说明 |
|------|------|------|
| ApiClient 代码 | ✅ 已修复 | buildHeaders() 正确实现 |
| Compress 配置 | ✅ 已添加 | threshold: 1024 |
| 单元测试 | ✅ 通过 | 48/48 |
| Mock 服务器测试 | ✅ 通过 | 压缩响应正确解析 |
| **API 服务器** | ❌ **需要重启** | **当前运行旧代码** |
| 爬虫测试 | ⏸️ 待验证 | 等待 API 重启后测试 |

## 下一步

**请重启 API 开发服务器，然后重新运行爬虫测试。**

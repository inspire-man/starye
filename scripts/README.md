# Starye 开发脚本

本目录包含用于开发和维护 Starye 项目的实用脚本。

## 可用脚本

### 🧹 clean-ports.ps1

清理开发服务占用的端口，解决端口冲突问题。

**使用方法：**

```powershell
# 交互式清理（会逐个询问是否终止进程）
pwsh ./scripts/clean-ports.ps1

# 强制清理所有端口（无需确认）
pwsh ./scripts/clean-ports.ps1 -Force

# 详细模式（显示所有端口状态）
pwsh ./scripts/clean-ports.ps1 -Verbose -Force
```

**或使用 npm 脚本：**

```bash
# 清理端口
pnpm clean:ports

# 清理端口后自动启动开发服务器
pnpm dev:clean
```

**清理的端口：**
- Gateway: 8080
- API: 8787
- Dashboard: 5173
- Blog: 3002
- Auth: 3003
- Comic: 3000
- Movie: 3001

### 🔍 check-services.ps1

检查所有开发服务的运行状态。

**使用方法：**

```powershell
pwsh ./scripts/check-services.ps1
```

**或使用 npm 脚本：**

```bash
pnpm check:services
```

**输出示例：**

```
=== Starye Services Status ===
[OK] Gateway on port 8080 (PID: 12345)
[OK] API on port 8787 (PID: 12346)
[!!] Auth on port 3003 - NOT RUNNING

=== Summary ===
Running: 6/7
Missing services: Auth
```

### 🔐 update-secrets.ps1

更新 Cloudflare Workers 的生产环境密钥。

**使用方法：**

```powershell
pwsh ./scripts/update-secrets.ps1
```

## 常见问题

### Q: 为什么需要清理端口？

A: 在开发过程中，如果服务异常退出或你手动停止了某些服务，进程可能仍占用端口。当你重新启动 `pnpm dev` 时，新服务会因为端口被占用而启动到其他端口（如 Auth 从 3003 漂移到 3008），导致 Gateway 路由失败。

### Q: 什么时候应该运行 clean-ports？

A: 在以下情况下运行：

1. **启动开发服务前**：确保所有端口都是干净的
2. **遇到端口冲突错误时**：如看到 "Unable to find an available port" 警告
3. **服务路由出现问题时**：如访问 `/auth` 但得到其他服务的响应
4. **重启开发环境时**：清理旧进程确保干净启动

### Q: 强制模式安全吗？

A: 强制模式（`-Force`）会直接终止占用端口的进程，不会询问确认。这些端口是项目专用的开发端口，一般很安全。如果你担心误杀其他进程，可以先运行 `check-services.ps1` 或不使用 `-Force` 参数。

### Q: 为什么使用 PowerShell 而不是跨平台脚本？

A: 考虑到项目主要在 Windows 上开发，PowerShell 提供了更好的原生支持和进程管理能力。未来可以添加 Shell 版本以支持 macOS/Linux。

## 推荐工作流

### 标准启动流程

```bash
# 1. 清理端口
pnpm clean:ports

# 2. 启动所有开发服务
pnpm dev
```

### 或使用一键命令

```bash
# 清理端口并启动（推荐）
pnpm dev:clean
```

### 检查服务状态

```bash
# 在另一个终端运行
pnpm check:services
```

## 贡献

如果你有更好的脚本想法或改进建议，欢迎提交 PR！

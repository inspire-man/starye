# ⚡ 快速修复 500 错误

> 如果您的爬虫出现 500 错误，请按以下步骤操作：

---

## 🚨 立即执行（3 分钟）

### 1️⃣ 设置密钥（Windows PowerShell）

```powershell
# 在项目根目录运行
.\scripts\setup-production-secrets.ps1
```

按提示输入 `y` 确认设置。

### 2️⃣ 部署 API

```powershell
cd apps\api
wrangler deploy
```

等待部署完成（约 10 秒）。

### 3️⃣ 测试连接

```powershell
cd ..\..\packages\crawler
pnpm test:api
```

**如果看到 "✅ 所有测试通过!"，说明修复成功！**

---

## ✅ 运行爬虫

```powershell
pnpm start "https://www.92hm.life/book/1045"
```

---

## 📊 查看日志（可选）

在另一个终端窗口：

```powershell
cd apps\api
wrangler tail --format pretty
```

您会看到详细的同步日志：
```
[Sync] 📥 Received manga: 獄火重生 (47 chapters)
[Sync] 📝 Upserting comic: 1045
[Sync] ✓ Comic upserted successfully
[Sync] 📚 Inserting 47 chapters in 1 batches
[Sync] ✅ Sync completed for 獄火重生
```

---

## ❌ 仍然有问题？

查看详细的故障排除指南：
- **完整文档**: `FIXES_SUMMARY.md`
- **故障排除**: `TROUBLESHOOTING.md`

或运行诊断：
```powershell
cd packages\crawler
pnpm test:api
```

这个命令会告诉您具体是哪里出了问题。

---

## 🎯 核心修复内容

我已经为您修复了：
- ✅ 启用了 Workers 日志（`wrangler.toml`）
- ✅ 改进了错误日志（详细显示每个步骤）
- ✅ 添加了数据验证（过滤无效章节）
- ✅ 添加了 30 秒超时（防止请求卡死）
- ✅ 创建了自动诊断工具（`test:api`）

**最重要的是**：您需要在生产环境设置 `CRAWLER_SECRET`！

---

现在就执行上面的 3 个步骤吧！ 🚀

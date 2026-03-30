# 自动化功能验证脚本

本目录包含用于验证 `aria2-integration-quality-rating` 变更的自动化测试脚本。

## 脚本列表

### 1. API 功能测试 (`test-aria2-rating-api.ts`)

测试后端 API 端点是否正常工作。

**运行方式：**

```bash
# 确保 API 服务正在运行
cd apps/api
pnpm run dev

# 在另一个终端运行测试
pnpm tsx scripts/test-aria2-rating-api.ts
```

**测试内容：**
- ✓ 评分 API（提交、查询、统计）
- ✓ Aria2 配置 API（获取、保存）
- ✓ Aria2 代理 API（RPC 转发）
- ✓ 影片 API（包含评分数据）

**预期结果：**
- 未登录状态应返回 401 错误（预期行为）
- 所有 API 端点应正常响应
- 响应数据格式正确

### 2. 数据库 Schema 验证 (`verify-db.ps1`)

验证数据库迁移是否正确执行。

**运行方式：**

```powershell
# 方式 1：使用 PowerShell 脚本（推荐）
.\scripts\verify-db.ps1

# 方式 2：手动检查
cd apps/api
pnpm exec wrangler d1 execute starye-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

**验证内容：**
- ✓ `ratings` 表是否存在
- ✓ `aria2_configs` 表是否存在
- ✓ `player` 表的新字段（`average_rating`, `rating_count`）
- ✓ 索引是否正确创建
- ✓ 数据查询是否正常

**常见问题：**

**Q: 提示找不到数据库？**
A: 确保先执行过数据库迁移：
```bash
cd apps/api
pnpm exec wrangler d1 migrations apply starye-db --local
```

**Q: 表不存在？**
A: 检查迁移记录：
```bash
pnpm exec wrangler d1 execute starye-db --local --command "SELECT * FROM d1_migrations ORDER BY applied_at DESC"
```

**Q: 迁移冲突？**
A: 可能需要手动执行 SQL：
```bash
pnpm exec wrangler d1 execute starye-db --local --file ../../packages/db/drizzle/0020_add_ratings_aria2.sql
```

### 3. 数据库 Schema 验证指南 (`verify-database-schema.ts`)

生成详细的验证指南和命令。

**运行方式：**

```bash
pnpm tsx scripts/verify-database-schema.ts
```

这会输出一系列可以手动执行的验证命令。

## 快速开始

### 完整验证流程

```bash
# 1. 确保数据库迁移已执行
cd apps/api
pnpm exec wrangler d1 migrations apply starye-db --local

# 2. 验证数据库 Schema
cd ../..
.\scripts\verify-db.ps1

# 3. 启动 API 服务
cd apps/api
pnpm run dev

# 4. 在另一个终端运行 API 测试
pnpm tsx scripts/test-aria2-rating-api.ts
```

### 前端功能验证

前端功能需要手动验证：

1. **启动前端应用：**
   ```bash
   cd apps/movie-app
   pnpm run dev
   ```

2. **验证 Aria2 设置：**
   - 访问个人中心 → Aria2 设置 Tab
   - 输入 RPC URL: `http://localhost:6800/jsonrpc`
   - 点击"测试连接"（需要先启动 Aria2）

3. **验证评分功能：**
   - 打开任意影片详情页
   - 查看播放源卡片上的评分显示
   - 点击"评分"按钮提交评分

4. **验证下载任务：**
   - 个人中心 → 下载任务 Tab
   - 查看任务列表、进度条、控制按钮

## Aria2 设置指南

### 安装 Aria2

**Windows:**
```powershell
# 使用 Scoop
scoop install aria2

# 或下载二进制文件
https://github.com/aria2/aria2/releases
```

**macOS:**
```bash
brew install aria2
```

**Linux:**
```bash
sudo apt install aria2  # Debian/Ubuntu
sudo yum install aria2  # CentOS/RHEL
```

### 启动 Aria2 RPC 服务

```bash
# 基本启动（无密钥）
aria2c --enable-rpc

# 带密钥启动（推荐）
aria2c --enable-rpc --rpc-secret=your-secret-token

# 完整配置
aria2c \
  --enable-rpc \
  --rpc-listen-all=false \
  --rpc-listen-port=6800 \
  --rpc-secret=your-secret-token \
  --max-concurrent-downloads=5 \
  --max-connection-per-server=16 \
  --split=16
```

### 验证 Aria2 连接

```bash
# 使用 curl 测试
curl http://localhost:6800/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "aria2.getVersion",
    "id": "test"
  }'
```

## 测试检查清单

### 后端 API ✓

- [x] 评分提交 API（未登录应返回 401）
- [x] 查询播放源评分统计
- [x] 查询用户评分历史
- [x] 查询全局评分统计
- [x] 获取 Aria2 配置
- [x] 保存 Aria2 配置
- [x] Aria2 代理请求
- [x] 影片详情包含评分数据

### 数据库 Schema ✓

- [x] `ratings` 表存在且结构正确
- [x] `aria2_configs` 表存在且结构正确
- [x] `player` 表包含新字段
- [x] 索引正确创建
- [x] 数据查询正常

### 前端功能 ⏳

- [ ] Aria2 设置界面正常显示
- [ ] 可以保存和加载配置
- [ ] 连接测试功能正常
- [ ] 评分组件正常显示
- [ ] 可以提交和修改评分
- [ ] 下载任务面板正常显示
- [ ] 任务控制按钮正常工作

### 集成测试 ⏳

- [ ] 端到端流程（配置 → 添加任务 → 评分）
- [ ] WebSocket 实时进度
- [ ] 评分聚合计算正确
- [ ] 推荐标签显示正确

## 故障排查

### 常见错误

**1. "找不到数据库"**
- 检查是否在正确的目录运行命令
- 检查 `wrangler.toml` 配置是否正确

**2. "表不存在"**
- 执行数据库迁移
- 检查迁移记录是否正确

**3. "API 返回 401"**
- 这是正常的！未登录用户应该返回 401
- 登录后应该能正常访问

**4. "Aria2 连接失败"**
- 检查 Aria2 是否正在运行
- 检查 RPC URL 和端口是否正确
- 检查密钥是否匹配

**5. "评分提交失败"**
- 确保已登录
- 检查 playerId 是否有效
- 检查评分值是否在 1-5 之间

## 下一步

完成验证后，可以：

1. 标记相关任务为完成
2. 更新 `tasks.md` 文档
3. 准备部署到生产环境
4. 编写用户文档和使用指南

## 联系

如有问题，请查看：
- `openspec/changes/aria2-integration-quality-rating/` 目录下的设计文档
- `tasks.md` 了解任务进度
- GitHub Issues 提交问题

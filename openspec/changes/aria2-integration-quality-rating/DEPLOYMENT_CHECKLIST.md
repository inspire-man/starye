# 部署清单 - Aria2 集成与评分系统

> 生产环境部署前的完整检查清单

---

## 📋 部署前准备

### 1. 代码检查

- [x] 所有功能已实现
- [x] 单元测试通过（202/202）
- [x] E2E 测试通过（8/8）
- [x] TypeScript 编译无错误
- [x] ESLint 检查通过
- [ ] Code Review 完成
- [ ] 合并到 main 分支

**验证命令**:
```bash
# 运行所有测试
pnpm run test

# TypeScript 检查
pnpm run type-check

# 前端构建测试
pnpm --filter movie-app run build

# 后端构建测试
pnpm --filter api run build
```

---

### 2. 数据库迁移

#### 开发环境
- [x] 迁移文件创建
- [x] 本地迁移执行成功
- [x] Schema 验证通过

#### 生产环境
- [ ] 备份当前数据库
- [ ] 准备回滚方案
- [ ] 执行迁移命令
- [ ] 验证表结构
- [ ] 验证索引创建

**执行步骤**:
```bash
# 1. 备份生产数据库
pnpm --filter @starye/db run db:backup:prod

# 2. 执行迁移（谨慎！）
pnpm --filter @starye/db run db:migrate:prod

# 3. 验证迁移
pnpm --filter @starye/db run db:verify:prod
```

**回滚计划**:
```sql
-- 如需回滚，执行以下 SQL
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS aria2_configs;
ALTER TABLE player DROP COLUMN averageRating;
ALTER TABLE player DROP COLUMN ratingCount;
```

---

### 3. 环境变量配置

#### 后端 (Cloudflare Workers)

在 Cloudflare Dashboard 配置 Secrets:

```bash
# 数据库连接（已存在）
DATABASE_URL=<D1 database URL>

# 认证配置（已存在）
BETTER_AUTH_SECRET=<existing secret>

# 新增：Aria2 加密密钥（可选）
ARIA2_ENCRYPTION_KEY=<随机生成的 32 字符密钥>
```

**生成加密密钥**:
```bash
# 使用 OpenSSL
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 前端 (Cloudflare Pages)

在 Pages 项目配置环境变量:

```bash
# API 地址（已存在）
VITE_API_URL=https://api.starye.com

# 新增：功能开关（可选）
VITE_ENABLE_ARIA2=true
VITE_ENABLE_RATING=true
```

---

### 4. 构建和部署

#### 后端部署

```bash
# 1. 构建后端
cd apps/api
pnpm run build

# 2. 测试部署脚本
pnpm run deploy:test

# 3. 部署到生产环境
pnpm run deploy

# 4. 验证部署
curl https://api.starye.com/api/health
```

**预期输出**:
```json
{
  "status": "ok",
  "version": "1.2.0"
}
```

#### 前端部署

```bash
# 1. 构建前端
cd apps/movie-app
pnpm run build

# 2. 本地预览
pnpm run preview

# 3. 推送到 main 分支触发自动部署
git push origin main

# 4. 等待 GitHub Actions 完成
# 5. 验证部署
curl https://starye.com
```

---

## 🧪 部署后验证

### 1. 冒烟测试

#### 健康检查

```bash
# 后端健康检查
curl https://api.starye.com/api/health

# 前端访问
curl -I https://starye.com
```

#### 基础功能

- [ ] 访问首页
- [ ] 登录功能
- [ ] 电影详情页加载
- [ ] 播放源列表显示

#### 新功能验证

**评分系统**:
- [ ] 评分按钮可见
- [ ] 提交评分成功
- [ ] 评分立即显示
- [ ] 个人评分历史可查询

**Aria2 集成**:
- [ ] Aria2 设置页面可访问
- [ ] 可以保存配置
- [ ] 下载按钮可见
- [ ] 任务列表显示

---

### 2. API 端点测试

使用 `curl` 或 Postman 测试：

#### 评分 API

```bash
# 获取播放源评分
curl https://api.starye.com/api/ratings/player/player-123 \
  -H "Cookie: session=YOUR_SESSION"

# 提交评分
curl -X POST https://api.starye.com/api/ratings \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{"playerId":"player-123","score":85}'
```

#### Aria2 API

```bash
# 获取配置
curl https://api.starye.com/api/aria2/config \
  -H "Cookie: session=YOUR_SESSION"

# 保存配置
curl -X PUT https://api.starye.com/api/aria2/config \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{"rpcUrl":"http://localhost:6800/jsonrpc","useProxy":true}'
```

---

### 3. 性能测试

#### 响应时间

```bash
# 评分查询
curl -w "@curl-format.txt" \
  https://api.starye.com/api/ratings/player/player-123

# 预期: < 200ms
```

**curl-format.txt**:
```
time_total: %{time_total}s
time_connect: %{time_connect}s
time_starttransfer: %{time_starttransfer}s
```

#### 并发测试

使用 Apache Bench (ab):

```bash
# 评分查询并发测试
ab -n 100 -c 10 https://api.starye.com/api/ratings/player/player-123

# 预期: 
# - 成功率 100%
# - 平均响应时间 < 200ms
# - 错误率 0%
```

---

### 4. 数据验证

#### 数据库检查

```sql
-- 检查评分表
SELECT COUNT(*) FROM ratings;

-- 检查 Aria2 配置表
SELECT COUNT(*) FROM aria2_configs;

-- 检查播放源评分字段
SELECT 
  id, 
  averageRating, 
  ratingCount 
FROM player 
WHERE averageRating IS NOT NULL 
LIMIT 10;
```

#### 数据完整性

- [ ] 评分分数范围正确（0-100）
- [ ] 外键关联正常
- [ ] 创建时间格式正确
- [ ] 加密字段可正常解密

---

## 🔍 监控设置

### 1. Cloudflare Workers 监控

在 Cloudflare Dashboard:

- [ ] 启用 Workers Analytics
- [ ] 配置告警规则（错误率 > 5%）
- [ ] 配置告警通知（Email/Slack）

### 2. 自定义监控指标

添加监控 Dashboard:

```
评分系统:
- 每日评分提交数
- 平均评分分布
- 评分失败率

Aria2 集成:
- 配置创建数
- RPC 请求成功率
- 任务添加数量
```

### 3. 日志收集

配置日志查询：

```bash
# Cloudflare Workers 日志
wrangler tail api-worker

# 搜索错误
wrangler tail api-worker | grep "ERROR"

# 搜索特定 API
wrangler tail api-worker | grep "/api/ratings"
```

---

## 🚨 告警配置

### 1. 错误率告警

- [ ] API 错误率 > 5%（5 分钟内）
- [ ] 数据库连接失败
- [ ] RPC 代理失败 > 10%

### 2. 性能告警

- [ ] API 响应时间 P95 > 500ms
- [ ] 前端 FCP > 3s
- [ ] 后端 CPU 使用率 > 80%

### 3. 业务告警

- [ ] 评分提交失败率 > 10%
- [ ] Aria2 配置失败率 > 20%
- [ ] 用户反馈负面评价

---

## 🔄 灰度发布（可选）

### 方案 1: 用户 ID 百分比

在代码中添加 Feature Flag:

```typescript
// 示例代码
const isFeatureEnabled = (userId: string) => {
  const hash = hashCode(userId)
  return (hash % 100) < 10 // 10% 用户
}
```

### 方案 2: 用户白名单

```typescript
const BETA_USERS = [
  'user-id-1',
  'user-id-2',
  // ...
]

const isFeatureEnabled = (userId: string) => {
  return BETA_USERS.includes(userId)
}
```

### 灰度步骤

1. **第一周**: 10% 用户（约 50-100 人）
2. **第二周**: 50% 用户（约 250-500 人）
3. **第三周**: 100% 用户（全量发布）

### 监控指标

- [ ] 新功能使用率
- [ ] 错误率对比（灰度 vs 全量）
- [ ] 用户反馈收集
- [ ] 性能影响评估

---

## 📝 文档更新

### 用户文档

- [x] Aria2 配置指南
- [x] 评分系统使用指南
- [x] 故障排查文档
- [ ] 发布公告
- [ ] FAQ 更新

### 开发者文档

- [x] API 文档更新
- [x] E2E 测试指南
- [ ] 架构图更新
- [ ] CHANGELOG 更新

---

## 🎯 验收标准

### 功能完整性

- [x] 所有设计功能已实现
- [x] 所有边界情况已考虑
- [ ] 所有手动测试通过

### 质量标准

- [x] 单元测试覆盖率 > 90%（当前 100%）
- [x] E2E 测试通过率 100%
- [x] 无 P0/P1 Bug
- [ ] 无阻塞性问题

### 性能标准

- [x] API 响应时间 < 200ms (P95)
- [x] 前端 FCP < 1.8s
- [ ] 生产环境验证

### 用户体验

- [x] UI/UX 符合设计稿
- [x] 移动端适配良好
- [x] 错误提示友好
- [ ] 用户反馈收集

---

## 🔙 回滚计划

### 前端回滚

```bash
# 1. 回滚到上一个版本
git revert <commit-hash>
git push origin main

# 2. 等待自动部署完成

# 3. 验证回滚
curl https://starye.com
```

### 后端回滚

```bash
# 1. 回滚 Workers 部署
wrangler rollback

# 2. 验证回滚
curl https://api.starye.com/api/health
```

### 数据库回滚

```sql
-- 执行回滚 SQL（见"数据库迁移"章节）
-- ⚠️ 注意：会丢失评分和 Aria2 配置数据
```

---

## 📞 紧急联系

### 关键人员

- **开发负责人**: [联系方式]
- **运维负责人**: [联系方式]
- **产品负责人**: [联系方式]

### 紧急响应

1. 发现 P0 Bug → 立即回滚
2. 发现 P1 Bug → 2 小时内修复
3. 性能问题 → 4 小时内优化
4. 用户投诉 → 1 小时内响应

---

## ✅ 最终确认

部署前，确认以下所有项目都已完成：

### 代码
- [ ] 代码已合并到 main
- [ ] 所有测试通过
- [ ] Code Review 通过

### 环境
- [ ] 环境变量已配置
- [ ] 数据库已迁移
- [ ] 备份已完成

### 部署
- [ ] 后端部署成功
- [ ] 前端部署成功
- [ ] 冒烟测试通过

### 监控
- [ ] 告警已配置
- [ ] 日志已启用
- [ ] Dashboard 已创建

### 文档
- [ ] 用户文档已更新
- [ ] API 文档已更新
- [ ] 发布公告已准备

---

**签署人**: _______________  
**日期**: _______________  
**状态**: ⏳ 待部署

---

## 📈 部署后 24 小时监控

### 关键指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| API 可用率 | > 99.9% | - | - |
| 错误率 | < 1% | - | - |
| P95 响应时间 | < 200ms | - | - |
| 评分提交数 | > 100 | - | - |
| Aria2 配置数 | > 50 | - | - |

### 检查时间点

- [ ] 部署后 1 小时
- [ ] 部署后 4 小时
- [ ] 部署后 12 小时
- [ ] 部署后 24 小时

---

**最后更新**: 2026-03-30  
**版本**: v1.2.0  
**负责人**: Starye Team

# Aria2 集成与评分系统 - 部署指南

## 📋 部署前检查清单

### 代码准备
- [x] 所有代码已提交到 Git
- [x] 单元测试通过
- [x] Linter 检查通过
- [x] 本地开发环境测试通过

### 数据库准备
- [ ] 生产数据库迁移脚本已准备
- [ ] 迁移脚本已在测试环境验证
- [ ] 数据备份已完成

### 文档准备
- [x] API 文档已更新
- [x] 用户使用指南已完成
- [x] 故障排查文档已完成

## 🚀 部署步骤

### 第 1 步：数据库迁移

#### 1.1 备份现有数据
```bash
# 使用 wrangler d1 export 导出当前数据
wrangler d1 export starye-db --output backup-$(date +%Y%m%d).sql
```

#### 1.2 应用迁移
```bash
# 在项目根目录执行
cd d:\my-workspace\starye
pnpm --filter @starye/db run db:migrate:prod
```

#### 1.3 验证迁移
```bash
# 检查表结构
wrangler d1 execute starye-db --command "SELECT name FROM sqlite_master WHERE type='table';"

# 验证新增表
wrangler d1 execute starye-db --command "SELECT * FROM ratings LIMIT 1;"
wrangler d1 execute starye-db --command "SELECT * FROM aria2_configs LIMIT 1;"

# 验证新增字段
wrangler d1 execute starye-db --command "PRAGMA table_info(player);"
```

### 第 2 步：初始化评分数据

#### 2.1 部署初始化脚本
先部署包含 `init-ratings` 路由的 API 版本：

```bash
cd apps/api
pnpm run deploy
```

#### 2.2 执行初始化
```bash
# 调用初始化 API（需要管理员权限）
curl -X POST https://api.starye.com/admin/init-ratings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

#### 2.3 验证结果
```bash
# 检查播放源的评分数据
wrangler d1 execute starye-db --command "SELECT id, averageRating, ratingCount FROM player LIMIT 10;"
```

### 第 3 步：部署后端 API

#### 3.1 配置环境变量
在 Cloudflare Workers 设置中添加：

```env
# Feature Flags（可选）
FEATURE_FLAG_ARIA2_INTEGRATION=true
FEATURE_FLAG_QUALITY_RATING=true
FEATURE_FLAG_RATING_AUTO_SCORE=true
FEATURE_FLAG_ARIA2_WEBSOCKET=true
```

#### 3.2 部署
```bash
cd apps/api
pnpm run deploy
```

#### 3.3 验证 API
```bash
# 健康检查
curl https://api.starye.com/api/health

# 测试评分 API
curl https://api.starye.com/api/ratings/player/PLAYER_ID

# 测试 Feature Flags
curl https://api.starye.com/api/feature-flags
```

### 第 4 步：部署前端应用

#### 4.1 配置环境变量
在 Cloudflare Pages 设置中添加：

```env
# Feature Flags
VITE_FEATURE_ARIA2=true
VITE_FEATURE_RATING=true
VITE_FEATURE_ARIA2_WS=true
VITE_FEATURE_AUTO_SCORE=true

# 监控开关（生产环境建议启用）
VITE_MONITORING_ENABLED=true

# API 地址
VITE_API_URL=https://api.starye.com
```

#### 4.2 触发部署
```bash
# 推送到 main 分支会自动触发部署
git push origin main
```

或手动触发：
```bash
cd apps/movie-app
pnpm run build
wrangler pages deploy dist
```

#### 4.3 验证前端
- 访问生产 URL
- 测试评分功能
- 测试 Aria2 设置页面
- 检查浏览器控制台无错误

### 第 5 步：功能验证

#### 5.1 评分系统
- [ ] 访问电影详情页，查看评分显示
- [ ] 登录后提交评分
- [ ] 验证评分实时更新
- [ ] 检查推荐标签显示
- [ ] 测试排序功能

#### 5.2 Aria2 集成
- [ ] 访问个人中心 → Aria2 设置
- [ ] 配置本地 Aria2 服务
- [ ] 测试连接
- [ ] 添加下载任务
- [ ] 验证任务状态同步
- [ ] 测试 WebSocket 通知（如启用）

#### 5.3 错误处理
- [ ] 测试网络断开情况
- [ ] 验证错误提示友好
- [ ] 确认失败操作会缓存并重试

## 📊 监控设置

### Cloudflare Workers 日志
1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages → 选择 API Worker
3. 查看 Logs 标签
4. 设置日志保留策略

### 自定义监控
```bash
# 查看错误日志（前 100 条）
curl https://api.starye.com/api/monitoring/errors?limit=100

# 查看性能指标
curl https://api.starye.com/api/monitoring/performance?limit=100
```

### 告警规则（可选）
- 错误率 > 5% 发送告警
- API 响应时间 P95 > 1s 发送告警
- Aria2 连接失败率 > 10% 发送告警

## 🎯 灰度发布策略

### 阶段 1：内部测试（5-10 人，1-2 天）
```bash
# 设置用户白名单
# 在 featureFlags.ts 中配置
updateFeatureFlag({
  name: 'aria2-integration',
  enabled: true,
  enabledFor: ['user-id-1', 'user-id-2', ...],
})
```

### 阶段 2：小范围灰度（10%，3-5 天）
```bash
# 启用 10% 用户
updateFeatureFlag({
  name: 'aria2-integration',
  enabled: true,
  enabledPercent: 10,
})
```

### 阶段 3：逐步放量（30% → 50% → 100%）
每个阶段观察 1-2 天，无重大问题则继续放量。

### 阶段 4：全量发布
```bash
# 全量启用
updateFeatureFlag({
  name: 'aria2-integration',
  enabled: true,
  enabledPercent: 100,
})
```

## 🔍 问题排查

### 评分不显示
1. 检查 API 响应: `curl https://api.starye.com/api/ratings/player/PLAYER_ID`
2. 检查缓存: 等待 5 分钟后重试
3. 检查数据库: `SELECT * FROM ratings WHERE playerId = 'xxx'`

### Aria2 连接失败
1. 检查用户配置的 RPC URL 是否正确
2. 验证 Aria2 服务是否运行
3. 检查 CORS 配置
4. 查看错误日志中的详细诊断信息

### WebSocket 频繁断连
1. 检查网络稳定性
2. 验证 Aria2 WebSocket 端口是否开放
3. 查看重连日志，确认降级到 HTTP 轮询

### 性能问题
1. 检查 API 缓存是否生效
2. 验证数据库索引已创建
3. 查看性能监控报告
4. 优化慢查询

## 🔄 回滚计划

如果部署后发现重大问题：

### 快速回滚
```bash
# 方案 1: Feature Flag 禁用
# 在 Cloudflare Workers 环境变量中设置
FEATURE_FLAG_ARIA2_INTEGRATION=false
FEATURE_FLAG_QUALITY_RATING=false
```

### 完整回滚
```bash
# 方案 2: 回滚代码
git revert <commit-hash>
git push origin main

# 等待自动部署完成
```

### 数据库回滚
```bash
# 方案 3: 恢复数据库（谨慎操作）
wrangler d1 execute starye-db --file backup-YYYYMMDD.sql
```

## 📞 支持联系

- **技术问题**: 提交 GitHub Issue
- **紧急故障**: 联系系统管理员
- **用户反馈**: 通过应用内反馈功能收集

---

**最后更新**: 2026-04-01  
**版本**: v1.0.0  
**状态**: ✅ 就绪部署

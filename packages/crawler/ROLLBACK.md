# 反检测功能回滚指南

## 概述

如果反检测功能导致问题，可以通过以下方式快速回滚到简单的重试逻辑。

## 回滚方式

### 方式 1：启用 Legacy 模式（推荐）

最快的回滚方式，无需修改代码：

#### GitHub Actions
在 `.github/workflows/daily-manga-crawl.yml` 中取消注释 `USE_LEGACY_MODE`：

```yaml
env:
  # 回滚开关
  USE_LEGACY_MODE: true # 启用 Legacy 模式
```

#### 本地运行
```bash
USE_LEGACY_MODE=true pnpm --filter @starye/crawler start
```

**Legacy 模式特性**：
- ✅ 关闭反检测功能（会话管理、请求头轮换、智能延迟）
- ✅ 使用简单的重试逻辑（最多重试 2 次）
- ✅ 固定延迟 3 秒/次
- ✅ 超时时间 60 秒
- ✅ 无成功率监控

### 方式 2：调整配置参数

如果只是偶尔出现问题，可以通过调整参数来改善：

```yaml
env:
  # 增加延迟（降低请求频率）
  CRAWLER_BASE_DELAY: 12000 # 12 秒（默认 8 秒）

  # 增加重试次数
  CRAWLER_MAX_RETRIES: 5 # 5 次（默认 3 次）

  # 关闭会话管理
  CRAWLER_ENABLE_SESSION: false # 关闭（默认 true）

  # 降低并发度
  CRAWLER_MANGA_CONCURRENCY: 1 # 1 个（默认 2 个）
```

### 方式 3：Git 回滚（最后手段）

如果需要完全移除反检测代码：

```bash
# 查看提交历史
git log --oneline packages/crawler/

# 回滚到反检测功能之前的版本
git revert <commit-hash>

# 或者重置到特定提交
git reset --hard <commit-hash>
```

## 回滚判断标准

### 何时需要回滚？

1. **成功率 < 80%** 连续 3 次运行
2. **ERR_ABORTED 错误率 > 30%**
3. **IP 被封禁**（连续 CONNECTION_REFUSED）
4. **运行时间显著增加**（> 2倍）

### 何时不需要回滚？

1. 偶尔出现的单次错误
2. 成功率 > 90%
3. 错误可通过恢复模式重试
4. 问题可通过调整参数解决

## 回滚验证

回滚后，检查以下指标：

1. **成功率**: 应恢复到 > 95%
2. **运行时间**: 应恢复正常
3. **错误类型**: ERR_ABORTED 应减少或消失
4. **完成数量**: 应保持或改善

## 回滚后的配置建议

使用 Legacy 模式时的推荐配置：

```yaml
env:
  USE_LEGACY_MODE: true

  # 可以适当增加并发（Legacy 模式更简单，负担更轻）
  CRAWLER_MANGA_CONCURRENCY: 3
  CRAWLER_CHAPTER_CONCURRENCY: 2

  # 限流保持保守
  CRAWLER_MAX_MANGAS: 60
```

## 问题报告

如果需要回滚，请记录以下信息用于调查：

1. **错误日志**：GitHub Actions 日志的完整输出
2. **成功率统计**：日志中的成功率数据
3. **错误类型分布**：哪种错误最多
4. **运行时间**：从开始到结束的时间
5. **处理数量**：成功/失败的漫画和章节数

提交 Issue 时附上这些信息，有助于改进反检测逻辑。

## 重新启用

当问题解决后，可以重新启用反检测功能：

1. 注释掉 `USE_LEGACY_MODE: true`
2. 使用小批量测试（`CRAWLER_MAX_MANGAS: 10`）
3. 观察 2-3 次运行的成功率
4. 逐步增加批量到正常值

## 联系支持

如有问题，请：
1. 查看 [故障排查指南](./README.md#故障排查)
2. 查看 [失败任务恢复](./RECOVERY.md)
3. 提交 GitHub Issue 并附上详细日志

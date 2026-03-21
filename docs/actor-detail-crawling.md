# 女优详情数据爬取指南

## 问题说明

Daily Movie Crawl 只会创建基础的女优记录（名称、slug），但不会自动爬取女优的详细信息（头像、生日、身高等）。

## 原因

为了提高爬取效率，主爬虫流程专注于影片数据，女优详情需要单独触发爬取。

## 解决方案

### 方法 1: 通过管理后台批量爬取（推荐）

1. **访问演员管理页面**
   ```
   https://starye.org/dashboard/actors
   ```

2. **使用筛选功能**
   - 选择"爬取状态" = "🔗 无链接" 或 "⚠️ 待爬取"
   - 选择"详情" = "📝 无详情"
   - 这样可以快速定位需要爬取的演员

3. **批量选择演员**
   - 点击表格左侧的复选框选择演员
   - 或点击"全选当前页"批量选择

4. **触发爬取**
   - 点击"重新爬取详情"按钮
   - 系统会将选中的演员标记为待爬取
   - 后台爬虫会自动处理这些演员

5. **验证结果**
   - 等待几分钟后刷新页面
   - 检查演员的"爬取状态"是否变为"✅ 已完成"
   - 点击演员名称查看详情页，确认头像等信息已更新

### 方法 2: 通过 API 手动触发（开发者）

```bash
# 批量重新爬取演员详情
curl -X POST https://starye.org/api/admin/actors/batch-recrawl \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"ids": ["actor-id-1", "actor-id-2", ...]}'
```

### 方法 3: 创建定时任务（TODO）

**建议创建 GitHub Actions 工作流**：

```yaml
# .github/workflows/actor-detail-crawl.yml
name: Weekly Actor Detail Crawl

on:
  schedule:
    - cron: '0 2 * * 0' # 每周日凌晨2点
  workflow_dispatch: # 允许手动触发

jobs:
  crawl-actor-details:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Actor Detail Crawl
        run: |
          # 调用专门的演员详情爬虫端点（需要实现）
          curl -X POST ${{ secrets.API_URL }}/api/admin/actors/crawl-pending \
            -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}"
```

## 数据流程

### 1. Daily Movie Crawl
```
JavBus 列表页 → 影片详情 → 提取演员名称 → 创建基础 actor 记录
                                          ↓
                                    hasDetailsCrawled: false
                                    sourceUrl: ''
```

### 2. Actor Detail Crawl
```
actors 表（hasDetailsCrawled: false）
    ↓
选中演员 → 批量标记 → 爬虫队列
    ↓
访问演员详情页 → 提取详细信息 → 更新 actor 记录
    ↓
hasDetailsCrawled: true
avatar: '...'
bio: '...'
birthDate: ...
```

## 数据检查

### 1. 查看待爬取演员数量

访问统计端点：
```
GET https://starye.org/api/admin/actors/stats
```

返回：
```json
{
  "total": 500,
  "crawled": 50,
  "pending": 450,
  "withSourceUrl": 300,
  "crawledPercentage": 10
}
```

### 2. 查看具体演员状态

访问演员列表：
```
GET https://starye.org/api/admin/actors?hasDetails=false&limit=20
```

查看哪些演员还没有详情数据。

## 常见问题

### Q: 为什么有些演员没有 sourceUrl？

**A**: 如果影片列表页没有提供演员详情页链接，`sourceUrl` 会为空。这种情况下无法自动爬取详情。

### Q: 批量爬取会不会被封禁？

**A**: 爬虫已实现反检测机制和速率限制，但建议分批次爬取，每次不超过 50 个演员。

### Q: 爬取失败的演员如何处理？

**A**: 
1. 检查 `crawlStatus` 字段
2. 如果为 `'failed'`，可以尝试重新爬取
3. 如果多次失败，可能需要手动补充数据

## 后续优化建议

1. **自动化爬取**：创建定时任务定期爬取待补全的演员
2. **优先级队列**：优先爬取作品数多的演员
3. **监控告警**：失败率过高时发送通知
4. **数据验证**：爬取后自动检查数据完整性

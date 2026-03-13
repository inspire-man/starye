# 爬虫失败任务恢复功能

## 功能说明

爬虫现在具备失败任务记录和恢复功能，可以：
1. 自动记录所有失败的爬取任务
2. 将失败任务保存到本地文件
3. 支持从失败记录中恢复重试

## 使用方法

### 漫画爬虫

#### 正常运行（自动记录失败）
```bash
pnpm --filter @starye/crawler crawl:manga
```

失败任务会自动保存到 `.crawler-failed-tasks.json`

#### 恢复失败任务
```typescript
import { ComicCrawler } from './crawlers/comic-crawler'
import { Site92Hm } from './strategies/site-92hm'

const crawler = new ComicCrawler(
  config,
  new Site92Hm(),
  'https://www.92hm.life/booklist?end=0',
  { recoveryMode: true } // 启用恢复模式
)

await crawler.run()
```

### 电影爬虫

#### 正常运行（自动记录失败）
```bash
pnpm --filter @starye/crawler crawl:movie
```

失败任务会自动保存到 `.javbus-failed-tasks.json`

#### 恢复失败任务
```typescript
import { JavBusCrawler } from './crawlers/javbus'

const crawler = new JavBusCrawler({
  // ... 其他配置
  recoveryMode: true // 启用恢复模式
})

await crawler.run()
```

## 失败任务文件格式

```json
[
  {
    "url": "https://example.com/manga/123",
    "errorType": "ERR_ABORTED",
    "errorMessage": "net::ERR_ABORTED",
    "attempts": 3,
    "timestamp": "2026-03-13T12:00:00.000Z"
  }
]
```

## 错误类型

- `ERR_ABORTED` - 连接被主动中止（可恢复）
- `TIMEOUT` - 请求超时（可恢复）
- `CONNECTION_REFUSED` - 连接被拒绝（可恢复）
- `HTTP_ERROR` - HTTP 错误 4xx/5xx（不可恢复，通常是资源不存在）
- `UNKNOWN` - 未知错误（可恢复）

## 注意事项

1. **自动过滤**: 恢复模式会自动过滤掉不可恢复的错误（如 HTTP_ERROR）
2. **文件位置**: 失败任务文件保存在爬虫运行目录
3. **清空记录**: 恢复模式运行前会清空当前记录，只记录新的失败
4. **重复保存**: 每次运行结束都会保存失败任务，覆盖旧文件

## 防重复机制

### 漫画爬虫
- 批量查询漫画状态 (`batchQueryStatus`)
- 跳过已存在的章节 (`existingChapters`)
- 优先级排序系统（连载中 > 部分完成 > 新漫画 > 已完成）

### 电影爬虫
- 批量查询影片状态 (`batchQueryMovieStatus`)
- 跳过已存在的影片（根据 code）

## 示例输出

### 失败摘要
```
❌ Failed Tasks Summary (5 total):

  ERR_ABORTED (3):
    - https://www.92hm.life/book/1141
    - https://www.92hm.life/book/1153
    - https://www.92hm.life/book/1157
    ... and 0 more

  TIMEOUT (2):
    - https://www.92hm.life/book/1150
    - https://www.92hm.life/book/1152

💡 其中 5 个任务可以恢复重试
💾 失败任务已保存到: ./.crawler-failed-tasks.json (5 个任务)
```

### 恢复模式输出
```
🔄 恢复模式：重试 5 个失败任务

📋 开始恢复 5 个失败任务...

🔄 重试: https://www.92hm.life/book/1141
📘 Processing Manga: https://www.92hm.life/book/1141
✅ 成功

🔄 重试: https://www.92hm.life/book/1153
❌ 恢复失败: https://www.92hm.life/book/1153

📊 恢复完成:
  成功: 4/5
  失败: 1/5
```

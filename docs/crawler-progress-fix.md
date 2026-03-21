# 爬虫进度显示修复

## 问题描述

用户报告爬虫显示"爬取完成"，但进度条只显示 30%（30/100），看起来没有完成。

### 问题日志

```
✅ 爬取完成！

📈 爬虫统计:
  运行时间: 136s
  发现影片: 300
  已存在: 270 (90.0%)
  新增: 30 (10.0%)
  处理中: 30
  成功: 30
  失败: 0
  图片下载: 30
  API 同步: 30
  处理速度: 13.24 部/分钟

进度 |████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░| 30% | 30/100
```

## 根本原因

进度条的 `total` 被硬编码为 `maxMovies` 配置值（如 100），但在增量爬取模式下：

1. 爬虫发现了 300 部影片
2. 其中 270 部已存在，被跳过
3. 只有 30 部是新的，需要处理
4. 成功处理了 30 部
5. 进度条显示：30/100 (30%)

**误导性**：用户看到 30% 会以为还有 70 部没处理，但实际上：
- 已发现的 300 部影片中，270 部已存在
- 只有 30 部需要处理，已全部完成
- 进度应该是 100%，而不是 30%

## 解决方案

### 1. 动态调整进度条总数

修改 `ProgressMonitor` 类，在增量模式下动态调整进度条的 `total` 值：

```typescript
// packages/crawler/src/utils/progress.ts

update(status: string): void {
  if (this.progressBar) {
    // 在增量模式下，动态更新进度条的总数为实际需要处理的影片数
    // 计算需要处理的影片数 = 已发现 - 已跳过
    const targetTotal = this.stats.moviesFound - this.stats.moviesSkippedExisting

    if (this.useIncrementalMode && targetTotal > 0) {
      // 动态调整进度条总数
      this.progressBar.setTotal(targetTotal)
    }

    this.progressBar.update(this.stats.moviesSuccess, { status })
  }
}

enableIncrementalMode(): void {
  this.useIncrementalMode = true
}
```

### 2. 在爬虫启动时启用增量模式

```typescript
// packages/crawler/src/crawlers/javbus.ts

async run(): Promise<void> {
  // ...
  await this.init()

  // 启用增量模式进度跟踪
  this.progressMonitor.enableIncrementalMode()
  // ...
}
```

### 3. 改进统计输出

添加"处理进度"行，更清楚地显示实际进度：

```typescript
console.log(`  处理进度: ${this.stats.moviesSuccess}/${newMoviesCount} (${processRate}%)`)
```

### 4. 添加说明信息

在爬取完成时，如果实际处理数少于配置的最大值，给出解释：

```typescript
const newMoviesCount = stats.moviesFound - stats.moviesSkippedExisting
if (newMoviesCount > 0 && stats.moviesSuccess < maxMovies) {
  console.log(`\n💡 说明: 虽然配置的最大影片数为 ${maxMovies}，但由于增量模式，`)
  console.log(`   实际只发现了 ${newMoviesCount} 部新影片需要处理。`)
  console.log(`   已成功处理 ${stats.moviesSuccess}/${newMoviesCount} 部 (${processRate}%)`)
}
```

## 修复后的效果

```
✅ 爬取完成！

📈 爬虫统计:
  运行时间: 136s
  发现影片: 300
  已存在: 270 (90.0%)
  新增: 30 (10.0%)
  处理进度: 30/30 (100.0%)
  成功: 30
  失败: 0
  图片下载: 30
  API 同步: 30
  处理速度: 13.24 部/分钟

进度 |████████████████████████████████████████| 100% | 30/30

💡 说明: 虽然配置的最大影片数为 100，但由于增量模式，
   实际只发现了 30 部新影片需要处理。
   已成功处理 30/30 部 (100.0%)
```

## 关键改进

1. **进度条准确性**：total 动态调整为实际需要处理的数量（新发现的影片）
2. **统计清晰性**：添加"处理进度"行，明确显示 30/30 (100%)
3. **用户理解**：添加说明信息，解释为什么处理数少于配置的最大值
4. **增量模式标识**：在启动日志中明确标注"增量模式: 已启用"

## 适用场景

这个修复特别适用于：
- 增量爬取（大部分影片已存在）
- 长期运行的爬虫（每天只爬取新内容）
- 需要准确显示实际处理进度的场景

## 注意事项

- 进度条的 total 会动态变化，初始可能是 100，随着发现新影片和跳过已存在影片，total 会调整为实际需要处理的数量
- 如果所有发现的影片都已存在，进度条可能会显示 0/0，这是正常的
- 这个修复不影响爬虫的实际逻辑，只是改进了进度显示

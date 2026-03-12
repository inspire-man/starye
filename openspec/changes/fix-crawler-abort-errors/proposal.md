# 修复爬虫连接中止错误

## Why

当前漫画爬虫在 GitHub Actions 环境中频繁出现 `net::ERR_ABORTED` 错误，导致爬取任务失败。这是因为目标网站（92hm.life）的反爬虫机制识别出了爬虫请求并主动中止连接。同时，Movie 爬虫虽然运行正常，但速度为 16.23 部/分钟，存在优化空间。

**核心问题**：
- 漫画爬虫请求头不够真实，被识别为机器人
- 缺乏有效的反爬虫对抗策略
- 重试机制无法应对连接被主动中止的情况

此变更 **MUST** 解决漫画爬虫的连接中止问题，同时优化整体爬虫的稳定性和速度。

## What Changes

**漫画爬虫修复**：
- 增强 Puppeteer 请求头伪装（User-Agent、Referer、Accept-Language 等）
- 实现更智能的请求延迟策略（随机化、指数退避）
- 添加 Cookie 和 Session 管理机制
- 改进错误重试逻辑（针对 ERR_ABORTED 的特殊处理）
- 添加请求成功率监控和自动降速

**Movie 爬虫优化**（可选）：
- 在保持稳定性前提下适度提升并发
- 优化图片处理流程，减少等待时间
- 添加性能监控和统计

**通用改进**：
- 统一爬虫反检测策略
- 改进日志输出，便于问题诊断
- 添加爬虫健康度检查

## Capabilities

### New Capabilities

- `crawler-anti-detection`: 反爬虫检测增强能力
  - 智能请求头管理
  - 动态延迟策略
  - 连接健康度监控
  - 自动降速机制

- `crawler-error-recovery`: 爬虫错误恢复能力
  - 针对性的错误分类和处理
  - 智能重试策略
  - 失败任务记录和恢复

### Modified Capabilities

- `crawler-configuration`: 现有爬虫配置能力的增强
  - 添加反检测相关配置项
  - 优化延迟和并发参数
  - 增加错误处理配置

## Impact

**代码影响**：
- `packages/crawler/src/strategies/site-92hm.ts` - 主要修改，添加反检测逻辑
- `packages/crawler/src/strategies/javbus.ts` - 参考优化（如需要）
- `packages/crawler/src/crawlers/comic-crawler.ts` - 错误处理增强
- `packages/crawler/src/config/crawl.config.ts` - 配置项扩展

**Workflow 影响**：
- `.github/workflows/daily-manga-crawl.yml` - 可能需要调整环境变量
- `.github/workflows/daily-movie-crawl.yml` - 参考优化

**依赖影响**：
- 可能需要添加新的 npm 包（如 User-Agent 生成库）
- Puppeteer 配置调整

**风险**：
- 过度伪装可能导致性能下降
- 延迟增加会降低爬取速度
- 需要平衡稳定性和速度

**预期结果**：
- 漫画爬虫 **SHALL** 在 GitHub Actions 中成功运行，错误率 < 5%
- Movie 爬虫保持当前稳定性，速度可选择性提升 10-20%
- 两个爬虫 **MUST** 支持统一的反检测配置

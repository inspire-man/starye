# Project Research Summary: v1.1 存储成本控制与代码/文件整理

**Researched:** 2026-07-11
**Scope:** Cloudflare 免费额度、R2/D1/Workers/Pages 成本边界、漫画章节图片外链化、文档与代码整理策略。

## Key Findings

### Cloudflare Cost Facts

- R2 Standard 免费层适合少量必要资产：10 GB-month/月、1M Class A/月、10M Class B/月，超出后会按存储和操作量计费。章节正文图体量大，不适合作为默认存储目标。
- R2 Infrequent Access 没有免费层，且有读取费、更高操作费和 30 天最短计费；不适合热门封面或漫画阅读正文图。
- D1 免费层对 URL 元数据很友好：5GB 总存储、每日 rows read/write 免费额度；存章节图片 URL 比存对象更符合当前预算约束。
- Workers 免费层有每日请求、CPU 和 subrequest 限制；图片代理会把阅读行为变成 Workers 请求/CPU 成本，默认不应启用。
- Pages 静态资源请求本身成本低，但 Pages Functions 仍计入 Workers；前端展示应直接使用 `img src`，避免走 Function 中转。

## Recommended Storage Policy

### R2 Allowlist

R2 仅允许以下用途：

- `covers/`：漫画/电影封面和必要预览图
- `avatars/`：演员头像、用户头像等必要头像
- `logos/`：publisher logo
- `fallback/`：阅读失败或占位用的小体积兜底图
- `manual-assets/`：后台手动上传的文章/内容资产
- `mappings/`：小体积 crawler mapping 文件，必须限制备份数量或生命周期
- `tmp/` / `crawler-debug/` / `import-staging/`：短期诊断或导入暂存，必须配置生命周期删除

禁止以下用途：

- 漫画章节正文图
- 批量 comic page/image mirror
- Worker/Pages Function 图片代理缓存
- 长期 debug dump、未限量 mapping backups

### Comic Chapter Images

- `pages.image_url` 保持存储源站图片 URL；字段语义应明确为源图片地址或外链地址，不代表 R2 object。
- `packages/crawler/src/crawlers/comic-crawler.ts` 不应对章节正文图调用 `ImageProcessor.process()`；只应规范化、校验并保存源站 URL。
- `apps/api/src/routes/public/comics/index.ts` 继续返回 `images: string[]`，但需要允许外链 URL 并可扩展图片来源元数据。
- `apps/comic-app/src/views/Reader.vue` 继续直连展示，但需要错误占位、失败页统计和可回退提示，避免用户看到纯黑/空白阅读页。

### Upload Guardrails

- `/api/upload` 应要求 `purpose` 枚举，并据此生成 key prefix；不能继续使用泛化 `images/`。
- Crawler 图片处理也需要同一套 purpose 策略，允许封面/头像/logo，拒绝 `comic_chapter_page`。
- 测试必须覆盖：章节正文图上传被拒绝、封面上传允许、mapping backup 不无限增长。

## Implications for Roadmap

1. 先做盘点和策略落地，避免在不了解现有对象/prefix 的情况下删除。
2. 再改 crawler 与 API 上传入口，切断新章节图进入 R2 的路径。
3. 接着补 Reader 失败状态和数据校验，接受外链风险但让风险可见。
4. 最后整理文档和代码入口，把 AGENTS.md 变短，把细节迁到 RUNBOOK 或专题文档。

## Watch Outs

- 源站图片可能失效、防盗链或变更路径；v1.1 目标是省钱与可控，不承诺外链永远稳定。
- 不要用 Worker 代理作为默认兜底；这会把省下来的 R2 存储成本转成 Workers 请求/CPU 成本。
- 删除旧 R2 对象前必须先做 prefix 清单和 DB 引用审计；误删后只能依赖源站重新抓取。
- `mappings/backups/` 如无生命周期规则，会以小文件形式长期增长并消耗 Class A 操作。
- AGENTS.md 瘦身不能删掉必须执行的 repo 规则；应保留“中文协作、Gateway 访问、GitNexus impact/detect_changes、测试命令、GSD 入口”，详细说明迁入文档。

## Sources

- Cloudflare R2 Pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 Storage Classes: https://developers.cloudflare.com/r2/buckets/storage-classes/
- Cloudflare R2 Object Lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Cloudflare D1 Pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Pages Functions Pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Pages Limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Budget Alerts: https://developers.cloudflare.com/billing/manage/budget-alerts/

---
*Research updated: 2026-07-11 for milestone v1.1*

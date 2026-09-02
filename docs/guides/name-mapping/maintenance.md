# 名字映射维护

本指南只记录当前可执行的名字映射工作流。历史实现方案和一次性报告位于 docs/archive/。

## 当前入口

生产 crawler 使用 registry-owned entry 和显式 TARGET：

~~~bash
pnpm --filter @starye/crawler crawl:actor -- --target TARGET
pnpm --filter @starye/crawler crawl:publisher -- --target TARGET
~~~

配置检查、R2 审计和 backfill 也使用同一入口：

~~~bash
pnpm --filter @starye/crawler check-config -- --target TARGET
pnpm --filter @starye/crawler audit:r2-storage -- --target TARGET --dry-run
pnpm --filter @starye/crawler crawl:backfill-covers -- --target TARGET --dry-run
~~~

TARGET 必须来自当前 target profile。远程操作前遵循 ../../../RUNBOOK.md 的 preflight、backup 和 evidence 顺序。

## 数据流

1. actor/publisher crawler 生成名字映射和未匹配清单。
2. 启用 R2 上传时，文件写入 mappings/，历史版本写入 mappings/backups/。
3. API 从 R2 读取清单和映射，并提供 mapping-quality、mapping-versions 和 add-mapping。
4. Dashboard 通过 /name-mapping-management 和 /mapping-quality-report 展示结果。

当前实现位置：

- ../../../packages/crawler/src/lib/mapping-file-manager.ts
- ../../../apps/api/src/routes/admin/crawlers/index.ts
- ../../../apps/dashboard/src/views/NameMappingManagement.vue
- ../../../apps/dashboard/src/views/MappingQualityReport.vue

## 人工审核

人工审核只处理 API 返回的未匹配清单：

1. 按作品数量和业务优先级筛选。
2. 核对源页面和候选 Wiki 页面。
3. 通过 Dashboard 的 add-mapping 操作提交。
4. 重新读取 mapping-quality 和 mapping-versions，确认持久化结果。

直接编辑生成的本地映射文件、手写 cron workflow 或运行历史 index-crawler 文件都不属于当前入口。

## 验证

提交前至少完成：

~~~bash
pnpm --filter @starye/crawler type-check
pnpm --filter @starye/crawler test
pnpm docs:check
~~~

浏览器从 http://localhost:8080/dashboard/ 进入，API 和 R2 数据以 D1/API 或 R2 authoritative readback 为准。

# @starye/crawler

Crawler 负责外部数据采集、解析、媒体处理、映射文件和受控 runner。生产操作必须经过 selected target、preflight 和 registry-owned entry。

## 生产入口

所有远程操作从仓库根目录或本包执行，并显式传入 TARGET：

~~~bash
pnpm --filter @starye/crawler crawl:optimized -- --target TARGET
pnpm --filter @starye/crawler crawl:comic -- --target TARGET
pnpm --filter @starye/crawler crawl:actor -- --target TARGET
pnpm --filter @starye/crawler crawl:publisher -- --target TARGET
pnpm --filter @starye/crawler crawl:enrich-players -- --target TARGET
pnpm --filter @starye/crawler audit:r2-storage -- --target TARGET --dry-run
~~~

其他 registry entry 和参数以 packages/config/src/deployment-target/mutation-entry.ts 为准。不要直接运行历史 entry 文件。

## 本地工具

~~~bash
pnpm --filter @starye/crawler local:test-anti-detection
pnpm --filter @starye/crawler local:test-seesaawiki
pnpm --filter @starye/crawler local:task-runner
~~~

单元测试、类型检查和 lint：

~~~bash
pnpm --filter @starye/crawler test
pnpm --filter @starye/crawler type-check
pnpm --filter @starye/crawler lint
~~~

## 映射与 R2

女优、厂商映射和未匹配清单由 crawler 写入 R2，Dashboard 通过 API 读取。映射管理入口见 ../../docs/guides/name-mapping/maintenance.md；R2 policy、cleanup、backup 和 rollback 见 ../../RUNBOOK.md。

UPLOAD_MAPPINGS_TO_R2 不是独立的旧脚本入口。生产环境变量必须由 selected target 配置投影，不能从任意本地环境直接注入。

## 失败与恢复

actor、publisher 的 recoveryMode 仍有未完成的转换逻辑。失败任务应通过 task/run/attempt 控制面和新的 prepared entry 处理，不把旧的直接脚本当作恢复命令。

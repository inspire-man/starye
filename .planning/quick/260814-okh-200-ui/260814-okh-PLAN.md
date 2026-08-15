# Quick Task 260814-okh: 清理非200封面与孤儿女优厂商、统一列表分页高级筛选和精细化抽屉UI

## Goal

清理本地与生产中封面真实 HTTP 状态非 200 的影片数据，删除无影片关联的女优/厂商并完成受支持的爬虫同步；同时为后台和相关列表页建立统一分页、超过三个筛选项折叠、高级筛选展开、Teleport 抽屉和精细化表格/操作栏视觉方案。

## Scope and constraints

- 保留工作树中已有的用户改动，不回滚或覆盖无关文件。
- 封面探测使用普通 GET/HEAD，不使用 Range 作为最终状态；超时与非 200 分开记录。
- 生产清理先导出并上传 D1 备份，清理 SQL 必须可审计、可回读。
- 只使用仓库已支持的 crawler/provider 入口；退休 workflow 不作为同步入口。
- 修改共享 symbol 前先做 GitNexus upstream impact；提交前执行 detect-changes。
- 本地验收通过 `http://localhost:8080/...` Gateway。

## Tasks

### 1. 数据审计、清理与重同步

- 复核本地/生产 D1、R2 和封面 URL 构成，生成 200、非 200、超时、空封面的清单。
- 备份生产 D1；删除非 200 封面对应的影片/封面引用与未引用 R2 对象，删除无影片关联的 actor/publisher，并重算关联计数。
- 确认支持的电影、女优、厂商同步入口，执行重同步，验证演员/厂商关联和 D1 读回结果。

### 2. 公共列表能力

- 抽取公共分页状态、URL/query 同步、总数/页码范围与页码控件，统一 API `page`/`pageSize` 参数。
- 将公共能力应用到后台所有列表页及任务历史 tab；保留列表级筛选和加载/空态/错误态。
- 筛选项超过 3 个时默认只展示前三项，其余放入“高级筛选”折叠区。

### 3. 抽屉与视觉统一

- `DetailDrawer` 使用 `Teleport` 到 `body` 的 fixed overlay，确保高于 sidebar stacking context。
- 统一页面容器、间距、圆角、边框、按钮尺寸、表格密度、对齐和操作栏。
- 视频任务历史与漫画任务历史使用两个 tab，下方使用 table，右侧固定操作栏；其他列表沿用同一结构。

## Verification

- 运行相关 Vitest、Dashboard/API type-check 和构建检查。
- 启动/使用本地 Gateway，验证列表分页、高级筛选、抽屉层级、任务历史 tab 和数据读回。
- 运行 `gitnexus_detect_changes({scope: "all", repo: "starye"})`，确认变更符号和执行流在预期范围内。

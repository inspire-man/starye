---
quick: 260815-i3i-dashboard-token
date: 2026-08-15
status: complete
---

# Dashboard 间距、主题与骨架屏精修

## Delivered

- `DataTable` 与 `SkeletonTable` 使用显式横向滚动容器，保留表头、选择列、操作列和真实行高，窄内容区不再裁切右侧列。
- `FilterPanel`、`Pagination`、`DataTable`、`DetailDrawer` 共用 Dashboard spacing、control height、radius、border 和 surface token；高级筛选仍按需展开。
- `DetailDrawer` 统一 16px overlay inset、20px body inset、12px panel radius、`z-index: 1200` 和固定 footer，移除漫画编辑抽屉的重复关闭按钮与二次滚动区域。
- 漫画编辑抽屉的表单、Tab、锁定提示、章节 table、危险操作和保存按钮全部改用 semantic theme token；Teleport 层同步映射 Tailwind `--color-*` token。
- 漫画列表工具栏在移动端允许换行，避免排序、批量操作和视图切换造成页面横向溢出。

## Verification

- `pnpm --filter @starye/ui type-check`
- `pnpm --filter dashboard type-check`
- `pnpm --filter dashboard exec vitest run`：12 个文件、149/149 通过
- `pnpm --filter dashboard lint`
- `pnpm --filter dashboard build`：使用本地 `STARYE_PAGES_BUILD_ENV_PATH`，构建成功
- `git diff --check`
- Gateway 浏览器检查：`http://localhost:8080/dashboard/comics`、`http://localhost:8080/dashboard/movies`
- 桌面端确认表格 `tableWidth=1114`、可视容器 `943`、`overflow-x=auto`、可横向滚动；抽屉 overlay `z-index=1200`、16px inset、panel radius 12px。
- `390x844` 确认抽屉为底部面板、页面 `scrollWidth === clientWidth`，电影筛选先收起为“筛选”，展开后显示“高级筛选 4 项”。

## Residual

- 本地漫画编辑抽屉仍会收到已有的章节接口错误提示“加载章节列表失败 - 返回上一页”；本次改动未触及章节 API 或数据 fixture。
- 构建保留既有 chunk size warning，不影响产物生成。


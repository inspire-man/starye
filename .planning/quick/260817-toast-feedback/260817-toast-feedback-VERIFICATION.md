---
quick: 260817-toast-feedback
status: passed
verified: 2026-08-17
---

# Verification

## Automated

| Check | Result |
| --- | --- |
| `pnpm --filter @starye/ui type-check` | PASS |
| `pnpm --filter @starye/ui lint` | PASS |
| `pnpm --filter @starye/ui build` | PASS |
| `pnpm --filter dashboard type-check` | PASS |
| `pnpm --filter dashboard lint` | PASS |
| `pnpm --filter dashboard test -- --run` | PASS, 14 files / 159 tests |
| `pnpm --filter comic-app type-check` | PASS |
| `pnpm --filter comic-app test -- --run` | PASS, 4 files / 15 tests |
| `pnpm --filter movie-app type-check` | PASS |
| `pnpm --filter movie-app lint` | PASS |
| `pnpm --filter movie-app test -- --run` | PASS, 20 files / 212 tests |
| Dashboard Toast/useToast 定向测试 | PASS, 3 files / 53 tests |
| Movie App Toast 定向测试 | PASS, 1 file / 9 tests |
| MovieDetail/Aria2/评分定向测试 | PASS, 3 files / 23 tests |
| Dashboard build | PASS；保留既有大 chunk warning |
| Movie App build | PASS |
| Comic App build | PASS |
| `git diff --check` | PASS |

## UI Boundary

- 共享 Toast 使用 semantic theme token，不在应用页面重新定义颜色体系。
- 共享容器统一挂载到 Movie App，局部 Profile/MovieDetail Toast 已移除。
- error 使用 `role="alert"` 与 assertive live region，其余通知使用 status/polite；进度条提供 `role="progressbar"` 和 `aria-valuenow`。
- 移动端使用左右安全区与纵向布局，`prefers-reduced-motion: reduce` 时关闭过渡动画。

## GitNexus

- 编辑前 impact：共享 `useToast`、`showToast`、`showProgress` 为 LOW；Movie App `useToast` 为 MEDIUM，7 个直接调用方，已通过兼容适配器保持调用契约。
- 提交前执行 `gitnexus_detect_changes(scope="all", repo="starye")`，确认变更集中在共享 Toast、Movie App 适配入口及对应测试/记录。

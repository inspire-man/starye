---
quick: 260818-j9a-r18
status: passed
verified: 2026-08-18
---

# Verification

## Automated

| Check | Result |
| --- | --- |
| `pnpm --filter @starye/movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts` | PASS, 11 tests |
| `pnpm --filter @starye/movie-app exec vitest run` | PASS, 20 files / 216 tests |
| `pnpm --filter @starye/movie-app exec vue-tsc -b` | PASS |
| `pnpm exec eslint apps/movie-app/src/views/MovieDetail.vue apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` | PASS |
| `pnpm --filter @starye/movie-app build` with existing local Pages env | PASS |
| `git diff --check` | PASS |

全量测试保留本地 TorrServer/Aria2 未连接提示，但测试结果全部通过。

## Gateway Browser Evidence

- Canonical URL: `http://localhost:8080/movie/MUDR-392`。
- R18/SFW 详情页显示“播放源已隐藏”和“管理访问状态”。
- 页面中的访问状态链接解析为 `http://localhost:8080/movie/profile`。
- 受限态 DOM 未显示 `check-video-layer`、`refresh-primary`、技术详情或播放源卡片。
- 真实视口检查确认受限态状态卡片、访问提示和底部导航无横向溢出。

## Scope Review

- MovieDetail 相关影响分析为 LOW，未发现跨模块调用方或受影响执行流。
- GitNexus `detect_changes` 仅涉及 MovieDetail 本地展示符号、测试和 GSD 文档，未发现受影响执行流。

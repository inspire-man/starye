## 方案

复用现有 target-profile 的 generic Pages pipeline，不新增 Quant 专用部署脚本或旁路凭据。

1. 在 `target-profile.schema.ts` 将 `quant` 加入 `targetPagesSurfaceValues`，让 profile 的 `pages`、canonical URL 校验和 Pages projection 自动覆盖 Quant。
2. 在 `target-projections.ts` 注册 `quant: '/quant/'`；在 `deploy-config.ts` 和 `public-runtime-input.ts` 将 Quant 归入 Vite surface。这样生成的公开 env 只包含 `VITE_TARGET_ID`、Gateway/API base、`VITE_APP_BASE_PATH`、build mode 及可选 Sentry 字段。
3. 在 `pages-redirects.ts` 增加 Quant 的固定模板：direct origin 重定向到 Gateway `/quant/:splat`，并保留 SPA fallback。
4. 在 `scripts/target-profile.ts` 增加 Quant 的 output directory 和 pnpm filter 映射；不改变其他 surface 的命令和清理行为。
5. 新增 `deploy-quant.yml`，结构与现有 Pages workflow 一致：resolve target、prepare mutation、run-pages-build、使用 prepared project 部署、always cleanup。
6. 通过 target profile、runtime env、redirect、target deploy 和 workflow contract 测试锁定这条契约；先在本地执行 Quant build，再执行 config package 定向测试和 OpenSpec strict。

## 边界与风险

- Pages project 名称只能来自 target profile 的 prepared output，workflow 不接收自由文本 project name。
- Quant 是 Vite surface，不引入 Nuxt 变量，也不把 Cloudflare token 传入 `run-pages-build` 的 child environment。
- 本 change 只增加配置和发布入口；实际生产发布仍由合并到 `main` 后的 GitHub Actions 完成。

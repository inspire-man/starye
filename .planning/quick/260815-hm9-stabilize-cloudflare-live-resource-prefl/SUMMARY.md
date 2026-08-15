---
quick: 260815-hm9-stabilize-cloudflare-live-resource-prefl
date: 2026-08-15
status: complete
---

# 稳定 Cloudflare 远端资源预检

## Delivered

- 只读 D1、R2、KV、Worker 和 Pages 资源检查在瞬时 Wrangler/API 失败时最多重试 3 次。
- 预检失败信息现在包含目标资源、尝试次数、退出码和限长脱敏 stderr 摘要。
- Wrangler 执行器保留 stderr 供预检诊断使用；令牌、账号密钥和 Bearer 值不会进入错误消息。
- 增加瞬时失败重试和诊断脱敏回归测试。

## Verification

- `pnpm --filter @starye/config test --run src/deployment-target/__tests__/live-checks.test.ts`：18/18 通过。
- `pnpm --filter @starye/config test --run`：33 个文件、290 个测试通过。
- `pnpm --filter @starye/config type-check`：通过。
- `pnpm --filter @starye/config lint`：通过。
- `git diff --check`：通过。
- GitNexus `detect_changes({ scope: "unstaged", repo: "starye" })`：3 个源码文件、6 个符号、low risk；无受影响执行流异常。

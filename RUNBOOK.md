# Starye RUNBOOK

一个自用的个人内容中台 —— 运维手册。记录需要在 Cloudflare Dashboard / Workers / Pages 等外部平台手动配置的项目，以及关键事故响应流程。

---

## WAF Rate Limiting 手配记录

**需求：** PUBSEC-03 — `/api/auth/sign-in` 限制 10 req/min/IP

**配置位置：** Cloudflare Dashboard → Security → WAF → Rate Limiting Rules

**规则配置：**

| 字段 | 值 |
|------|-----|
| 规则名 | `starye-signin-ratelimit` |
| 匹配条件 | URI Path equals `/api/auth/sign-in` AND Request Method equals `POST` |
| 阈值 | 10 requests per 1 minute per IP |
| 动作 | Block（返回 429 Too Many Requests） |
| 响应码 | 429 |
| 适用范围 | starye.org（主域名） |

**配置步骤：**

1. 登录 Cloudflare Dashboard → 选择 `starye.org` 域名
2. 进入 Security → WAF → Rate Limiting Rules
3. 点击 "Create rule"
4. 填写规则名：`starye-signin-ratelimit`
5. 在 "When incoming requests match..." 设置：
   - Field: URI Path，Operator: equals，Value: `/api/auth/sign-in`
   - 点击 "And"，Field: Request Method，Operator: equals，Value: `POST`
6. 在 "Rate limit" 设置：Requests: 10，Period: 1 minute，Characteristics: IP
7. 在 "Then take action..." 选择：Block
8. 保存规则

**验证方式：**

```bash
# 连续发送 11 次 POST 请求，第 11 次应返回 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://starye.org/api/auth/sign-in \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# 期望：前 10 次返回 401（密码错误），第 11 次返回 429（限速）
```

**注意：** Cloudflare 免费 plan 的 Rate Limiting 规则有数量限制（通常 1 条）。如果需要其他规则，需评估是否升级 plan 或合并规则。

**配置日期：** _（配置完成后填写）_

**配置人：** _（填写）_

---

## ADMIN_GITHUB_ID 白名单配置

**需求：** D-03, D-04 — 使用 GitHub 数字 ID 作为硬编码白名单，覆盖 DB 中的 `user.role`，用于个人自用场景。

**配置位置：** Cloudflare Workers → API Worker → Settings → Variables & Secrets

**步骤：**

1. 访问 `https://github.com/<你的用户名>` 页面，右键查看源代码或使用 API `https://api.github.com/users/<username>`，找到 `id` 字段（数字形式）
2. 在 API Worker 配置中添加 Secret：
   - 名称：`ADMIN_GITHUB_ID`
   - 值：该数字 ID（字符串形式，例如 `12345678`）；如需多账号，用逗号分隔：`12345678,87654321`
3. 使用 wrangler CLI 配置（推荐）：
   ```bash
   cd apps/api
   wrangler secret put ADMIN_GITHUB_ID
   # 粘贴 GitHub ID 回车
   ```
4. 同样配置 Gateway Worker：
   ```bash
   cd apps/gateway
   wrangler secret put ADMIN_GITHUB_ID
   ```

**效果：**

- API：命中白名单的 session 通过所有 `requireAuth(['admin'|'super_admin'])` 检查，不依赖 DB 的 `user.role`
- Gateway：命中白名单的 session 允许访问 `/dashboard/*`，其他访问返回 403

**配置日期：** _（配置完成后填写）_

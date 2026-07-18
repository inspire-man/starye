# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## local-github-login-redirect - Local GitHub OAuth callback returned invalid_code
- **Date:** 2026-07-18
- **Error patterns:** invalid_code, github.validateAuthorizationCode, ConnectEx #121, UND_ERR_CONNECT_TIMEOUT, github.com:443, system proxy, Clash TUN, Node, workerd
- **Root cause:** Windows system proxy routing and the Node/workerd direct route were split. The browser reached GitHub through the system proxy, but with Clash TUN disabled workerd's direct TCP connection to GitHub's token endpoint timed out; Better Auth mapped the provider exception to `invalid_code`.
- **Fix:** Enabled Clash TUN so the browser, Node, and workerd use a unified usable outbound network path. No production code or repository configuration fix was made.
- **Files changed:** .planning/debug/resolved/local-github-login-redirect.md, .planning/debug/resolved/local-github-login-redirect-workerd-reachability.mjs, .planning/debug/knowledge-base.md
---

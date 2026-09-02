# Frontend

前端应用通过 Gateway 作为统一浏览器入口，应用自身端口只用于诊断。

| 应用 | 本地入口 | 局部文档 |
|------|----------|----------|
| Dashboard | /dashboard/ | ../apps/dashboard/README.md |
| Movie | /movie/ | ../apps/movie-app/README.md、../apps/movie-app/docs/README.md |
| Comic | /comic/ | ../apps/comic-app/README.md |
| Blog | /blog/ | ../apps/blog/README.md |
| Auth | /auth/ | ../apps/auth/README.md |
| Quant | /quant/ | ../apps/quant-app/README.md |

共享组件和跨应用 UI 契约位于 packages/ui，并通过 OpenSpec 记录需要跨边界协调的变化。

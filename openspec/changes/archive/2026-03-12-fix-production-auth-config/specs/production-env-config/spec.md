# Spec: 生产环境环境变量配置系统

## ADDED Requirements

### Requirement: 客户端代码使用 Vite 环境变量

所有前端应用的客户端代码 **SHALL** 使用 `import.meta.env.VITE_API_URL` 访问 API URL，而非 `process.env.*`。

#### Scenario: 开发环境默认值
- **WHEN** 本地开发环境未设置 `VITE_API_URL`
- **THEN** 应用 **SHALL** 使用 `http://localhost:8080` 作为默认 API URL

#### Scenario: 生产环境构建
- **WHEN** GitHub Actions 构建时设置 `VITE_API_URL=https://starye.org`
- **THEN** Vite **SHALL** 在构建时将 `import.meta.env.VITE_API_URL` 替换为 `https://starye.org`

#### Scenario: 构建产物验证
- **WHEN** 检查生产构建产物（`dist/` 目录）
- **THEN** JavaScript 文件 **SHALL NOT** 包含 `localhost:8080` 字符串（除注释外）
- **AND** JavaScript 文件 **SHALL** 包含 `https://starye.org` 字符串

---

### Requirement: GitHub Actions 构建时环境变量

所有前端应用的 GitHub Actions 部署 workflow **SHALL** 在构建步骤中设置 `VITE_API_URL` 环境变量。

#### Scenario: Auth 应用部署
- **WHEN** GitHub Actions 执行 `deploy-auth.yml` workflow
- **THEN** 构建步骤 **SHALL** 设置环境变量 `VITE_API_URL=https://starye.org`

#### Scenario: Blog 应用部署
- **WHEN** GitHub Actions 执行 `deploy-blog.yml` workflow
- **THEN** 构建步骤 **SHALL** 设置环境变量 `VITE_API_URL=https://starye.org`

#### Scenario: Comic 应用部署
- **WHEN** GitHub Actions 执行 `deploy-comic.yml` workflow
- **THEN** 构建步骤 **SHALL** 设置环境变量 `VITE_API_URL=https://starye.org`

---

### Requirement: 环境变量命名一致性

所有前端应用 **SHALL** 使用统一的环境变量名称 `VITE_API_URL`，而非 `NUXT_PUBLIC_API_URL` 或其他变体。

#### Scenario: 客户端代码统一
- **WHEN** 检查所有 `auth-client.ts` 文件
- **THEN** 所有文件 **SHALL** 使用 `import.meta.env.VITE_API_URL`
- **AND** 所有文件 **SHALL NOT** 使用 `process.env.NUXT_PUBLIC_API_URL`

#### Scenario: 部署脚本统一
- **WHEN** 检查所有 `deploy-*.yml` workflow 文件
- **THEN** 所有文件 **SHALL** 在构建步骤设置 `VITE_API_URL`
- **AND** 所有文件 **SHALL NOT** 设置 `NUXT_PUBLIC_API_URL`（仅构建步骤）

---

### Requirement: Node.js 24 升级

所有 GitHub Actions workflows **SHALL** 使用 Node.js 24 运行，以消除 deprecation 警告并符合 GitHub 2026-06-02 的强制切换要求。

#### Scenario: Setup Node.js action 配置
- **WHEN** 检查所有 workflow 文件中的 `actions/setup-node@v4`
- **THEN** 所有 workflow **SHALL** 设置 `node-version: 24`
- **AND** 所有 workflow **SHALL NOT** 使用 `node-version: 20` 或更低版本

#### Scenario: CI 执行无 deprecation 警告
- **WHEN** GitHub Actions 执行任意 workflow
- **THEN** 执行日志 **SHALL NOT** 包含 "Node.js 20 actions are deprecated" 警告
- **AND** 执行日志 **SHALL** 显示使用 Node.js 24

#### Scenario: 构建兼容性验证
- **WHEN** 在 Node.js 24 环境下执行 `pnpm install && pnpm build`
- **THEN** 所有构建 **SHALL** 成功完成
- **AND** 所有测试 **SHALL** 通过（如有）

---

### Requirement: 本地开发环境不受影响

本次修复 **SHALL NOT** 影响本地开发环境的正常运行。

#### Scenario: 本地开发默认配置
- **WHEN** 本地未设置任何环境变量
- **THEN** 所有应用 **SHALL** 使用 `http://localhost:8080` 作为 API URL
- **AND** 所有应用 **SHALL** 正常启动和运行

#### Scenario: 本地使用 .env 文件
- **WHEN** 本地创建 `.env` 文件并设置 `VITE_API_URL=http://localhost:3000`
- **THEN** 所有应用 **SHALL** 使用 `http://localhost:3000` 作为 API URL

---

### Requirement: 文档更新

项目 **SHALL** 提供清晰的环境变量配置文档。

#### Scenario: README 包含环境变量说明
- **WHEN** 查看项目根目录的 `README.md`
- **THEN** 文档 **SHALL** 包含生产环境变量配置说明
- **AND** 文档 **SHALL** 包含本地开发环境设置步骤

#### Scenario: .env.example 包含示例
- **WHEN** 查看项目根目录的 `.env.example`
- **THEN** 文件 **SHALL** 包含 `VITE_API_URL` 的示例值
- **AND** 文件 **SHALL** 包含注释说明各环境的配置方式

#### Scenario: 部署文档存在
- **WHEN** 查看项目根目录
- **THEN** **SHALL** 存在 `DEPLOYMENT.md` 文档
- **AND** 文档 **SHALL** 说明 Cloudflare Pages 部署的环境变量配置步骤

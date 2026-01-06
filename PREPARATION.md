# 本地环境清理与准备指南 (Preparation Guide)

为了确保 **Starye** 项目从零开始处于一个干净、无冲突的环境，请在正式启动开发前执行以下准备工作。

## 1. Cloudflare 环境清理 (Reset Wrangler)
旧的登录状态或过时的配置文件常会导致部署权限报错。

1. **登出当前账号**:
   ```powershell
   npx wrangler logout
   ```

2. **清理本地配置文件**:
   删除 Windows 用户目录下的 `.wrangler` 文件夹（存储了旧的 Auth Token 和缓存）。
   ```powershell
   # 在 PowerShell 中执行
   Remove-Item -Path "$HOME\.wrangler" -Recurse -Force -ErrorAction SilentlyContinue
   ```

3. **重新登录**:
   执行以下命令，并在弹出的浏览器窗口中完成授权。
   ```powershell
   npx wrangler login
   ```

---

## 2. 核心工具链检查
本项目采用 **Monorepo (pnpm workspace)** 架构，必须确保以下工具可用。

1. **Node.js**: 建议版本 `v20.x` 或更高 (LTS)。
   ```powershell
   node -v
   ```

2. **pnpm**: 必须安装。
   ```powershell
   # 如果未安装
   npm install -g pnpm
   # 检查版本
   pnpm -v
   ```

3. **Git**: 检查基础配置。
   ```powershell
   git config user.name
   git config user.email
   ```

---

## 3. 项目目录初始化
确保工作目录 `D:\my-workspace\starye` 下没有旧的干扰文件。

1. **清理 node_modules**:
   如果目录中已存在 `node_modules`，请先删除。
   ```powershell
   Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
   ```

2. **确认文件**:
   目前项目应仅包含 `GEMINI.md` 和本 `PREPARATION.md`。

---

## 4. 下一步操作
当你完成 `npx wrangler login` 授权后，请回到对话框回复：

**“环境已就绪，开始 Phase 1”**

我将立即开始执行 Monorepo 的脚手架搭建。

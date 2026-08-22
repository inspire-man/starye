# OpenSpec

OpenSpec 是仓库内的规格与变更记录工具，不是 agent 编排器，也不需要 skill。当前项目使用 `spec-driven` schema；历史 specs 和 archive 保留用于追溯。

## 何时使用

- 单文件 bug、局部样式或已有行为的小修复：直接改代码、补测试、验证。
- 跨 `api/db/frontend`、新增接口/数据模型、影响多个 app，或需要设计与任务追踪：建立 OpenSpec change。

## 最小流程

1. 查看当前 change：

   ```bash
   npx --yes @fission-ai/openspec@latest list --json
   ```

2. 新建 change：

   ```bash
   npx --yes @fission-ai/openspec@latest new change 2026-08-22-feature-name
   ```

3. 查看状态与下一份 artifact：

   ```bash
   npx --yes @fission-ai/openspec@latest status --change 2026-08-22-feature-name --json
   npx --yes @fission-ai/openspec@latest instructions proposal --change 2026-08-22-feature-name --json
   ```

4. 按状态创建 `proposal.md`、`specs/*/spec.md`、`design.md`、`tasks.md`。每次只处理当前需要的 artifact，不读取整个 archive。

5. 实现 tasks，并在代码验证通过后把对应任务标为 `[x]`：

   ```bash
   npx --yes @fission-ai/openspec@latest instructions apply --change 2026-08-22-feature-name --json
   ```

6. 验证 change：

   ```bash
   npx --yes @fission-ai/openspec@latest validate --changes --strict --no-interactive
   ```

7. 全部任务完成后归档：

   ```bash
   npx --yes @fission-ai/openspec@latest archive 2026-08-22-feature-name
   ```

## Token 规则

- 先读 `openspec/config.yaml`、目标 change 的 `proposal.md`、相关 spec、`design.md`、`tasks.md`。
- 不要默认读取 `openspec/specs/` 全量或 `changes/archive/`。
- 同一 change 内只打开当前任务涉及的 spec 和代码；完成后只保留摘要、验证结果和未完成项。
- `openspec list --json` 是当前 change 状态源，不根据目录名猜进度。

## 当前仓库

用 `openspec list --json` 获取实时 change 列表。旧的未归档 change 可能仍有完整 planning artifacts，但任务进度不等于当前需求；新需求应新建 change，不要自动接管旧 change。

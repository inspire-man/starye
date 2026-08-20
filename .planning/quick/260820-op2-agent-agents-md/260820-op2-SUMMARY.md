---
quick: 260820-op2
slug: agent-agents-md
description: 精简 agent 规则文档并更新 AGENTS.md
completed: 2026-08-20
status: complete
---

# Quick Task Summary

已将工程原则写入唯一 canonical agent 文档，并收敛三份仓库规则文档的职责边界。

## 变更

- `AGENTS.md`：新增 7 条工程原则，保留短版文档入口、工作规则和 GitNexus guardrails。
- `CLAUDE.md`：删除重复规则手册，只保留兼容入口和读取顺序。
- `docs/documentation-ownership.md`：保留 canonical owner、边界规则和更新触发器。

## 验证

- `git diff --check` 通过。
- 三份文档的相对 Markdown 链接均可解析。
- 三份文档不再包含重复的 GitNexus 长手册或历史 sweep 区块。
- GitNexus `detect_changes` 已运行；结果包含当前工作树中用户已有的代码改动。本 quick task 未修改代码 symbol，也未提交。

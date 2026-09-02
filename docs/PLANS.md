# Plans

Starye 使用两套互补的版本化计划记录：

- .planning/：milestone、phase、当前状态、研究和验收证据。
- openspec/：能力规格、设计、实现任务和 change 历史。

轻量且不改变跨层契约的执行计划可以放在 exec-plans/。进入实现前先判断是否应建立 OpenSpec change；不要把历史 phase 证据复制到 docs/。

当前状态从 .planning/STATE.md 读取，当前 change 列表使用以下命令获取：

    npx --yes @fission-ai/openspec@latest list --json

完成标准由相关 change、测试、Gateway 验收和必要的 D1 authoritative readback 共同决定。

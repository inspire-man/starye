## ADDED Requirements

### Requirement: 系统能够检查文档系统完整性

系统 MUST 提供 pnpm docs:check 命令，离线验证来源清单、托管资料文件、.version 哈希、generated 索引和 live Markdown 的本地链接。任一不一致 MUST 返回非零退出码并指出文件和原因。

#### Scenario: 文档系统完整

- **WHEN** 清单、正文、版本哈希和 generated JSON 一致且 live Markdown 链接都可解析
- **THEN** pnpm docs:check 返回 0
- **AND** 输出检查通过的汇总

#### Scenario: 发现路径漂移

- **WHEN** live Markdown 指向不存在的本地文件，或索引指向不存在的参考资料
- **THEN** pnpm docs:check 返回非零
- **AND** 输出每个失效路径及其来源文件

#### Scenario: CI 强制检查

- **WHEN** GitHub Actions 执行 CI
- **THEN** CI 在 lint、type-check 和测试前执行 pnpm docs:check
- **AND** 文档完整性失败时 workflow 失败

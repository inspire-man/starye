# References

references/ 保存供 agent 定向读取的外部资料。

## 托管框架资料

frameworks/ 下的 llms.txt 由 scripts/docs-sources.json 定义来源并由 pnpm docs:sync 更新。每个目录的 .version 记录来源、下载时间、SHA256 和大小；这些文件不要手工编辑。

## 非托管资料

unmanaged/ 只保留暂未纳入同步清单的参考资料，例如 Workers AI。它们不参与托管框架索引，也不代表当前 package 依赖。

## 维护

- pnpm docs:sync：下载变化内容并重新生成索引。
- pnpm docs:meta：重新生成 generated/_meta.json。
- pnpm docs:index：重新生成 generated/_sections.json。
- pnpm docs:check：检查 manifest、版本哈希、生成物和 live 文档链接。

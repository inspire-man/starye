## Implementation
- [x] 1.1 统一高级区域间距、控件背景及日期收缩。
## Verification
- [x] 2.1 UI lint/type-check、Dashboard type-check 和 strict 校验。
- [x] 2.2 实际浏览器展开高级筛选，检查间距与颜色。

验收：FilterPanel 的输入、下拉、日期背景统一为 `hsl(var(--background))`，高级区域行距 18px；Gateway Dashboard `/dashboard/movies` 实测展开后所有控件背景为 `rgb(246, 247, 249)`，无横向溢出。UI lint/type-check、Dashboard type-check、OpenSpec strict 通过。

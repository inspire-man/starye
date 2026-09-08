## Implementation
- [x] 1.1 媒体状态与各页面 restricted 接入。
- [x] 1.2 电影比例、标题高度、图标与键盘焦点调整。
## Verification
- [x] 2.1 卡片状态测试、Movie/Comic 回归与类型检查。
- [x] 2.2 Gateway 浏览器布局与 OpenSpec strict 验证。

验收：Movie 237 项、Comic 15 项通过；新增卡片测试覆盖受限 URL 不创建 img、缺图与受限区分、失败后更换 URL 恢复。UI lint/type-check、Movie/Comic vue-tsc 通过，OpenSpec strict 通过。Gateway 现有登录态目录有 20 张卡片，实际 CSS 为 4:3/object-contain，桌面与 390px 列表无横向溢出；未将受限/失败状态的组件测试当成匿名生产浏览器证明。GitNexus staged 风险 LOW。

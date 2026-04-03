## ADDED Requirements

### Requirement: Dashboard PostEditor 使用 wangEditor v5

`apps/dashboard/src/views/PostEditor.vue` MUST 将原纯文本 textarea 替换为 wangEditor v5 富文本编辑器（`@wangeditor/editor-for-vue`），编辑器 MUST 输出 HTML 字符串保存至 `form.content`。

编辑器配置：
- 工具栏包含：标题（H1-H3）、加粗、斜体、行内代码、代码块、有序/无序列表、引用、链接、图片上传、水平分割线、撤销/重做
- 初始内容：编辑已有文章时加载已保存的 HTML content
- 高度：最小 400px，支持自适应内容高度

#### Scenario: 编辑器正常初始化
- **WHEN** 管理员访问 `/posts/new`（新建文章）
- **THEN** 页面 SHALL 展示 wangEditor 富文本编辑器，工具栏完整可用

#### Scenario: 编辑已有文章时加载内容
- **WHEN** 管理员访问 `/posts/:id`（编辑已有文章）
- **THEN** wangEditor SHALL 加载并展示该文章已保存的 HTML content，可继续编辑

#### Scenario: 组件卸载时正确销毁编辑器实例
- **WHEN** 管理员离开 PostEditor 页面
- **THEN** wangEditor 实例 SHALL 调用 `editor.destroy()` 进行资源释放，防止内存泄漏

---

### Requirement: wangEditor 支持图片上传到 R2

wangEditor 的图片上传功能 MUST 通过 `customUpload` 回调对接 `POST /api/upload`（已有接口），上传成功后将 R2 CDN URL 注入编辑器内容。

上传流程：
1. 用户在编辑器中点击「上传图片」或拖拽图片文件
2. `customUpload` 回调被触发，获取 `File` 对象
3. 调用 `POST /api/upload`（FormData，字段名 `file`），携带 auth cookie
4. 响应成功后调用 `insertFn(url, alt, '')` 将图片插入编辑器
5. 上传失败时展示错误提示（通过现有 `handleError` 工具）

#### Scenario: 上传图片并插入编辑器
- **WHEN** 管理员在编辑器中点击图片上传按钮并选择图片文件
- **THEN** 图片 SHALL 上传至 R2 并在编辑器内容中显示，`form.content` HTML 包含对应 `<img src="cdn-url">` 标签

#### Scenario: 上传失败时显示错误
- **WHEN** 图片上传 API 返回错误（如文件类型不支持）
- **THEN** 页面 SHALL 通过 `handleError` 展示错误提示，编辑器内容不变

---

### Requirement: PostEditor 支持 tags、series、seriesOrder 字段编辑

PostEditor MUST 在元数据编辑区域新增以下输入控件：

- **tags 输入**：chip 样式标签输入，支持输入后回车/逗号确认添加标签，点击已有标签 ×  删除。数据绑定到 `form.tags: string[]`
- **series 文本输入**：输入系列 slug（如 `ts-fullstack-ai-chronicle`），数据绑定到 `form.series: string`
- **seriesOrder 数字输入**：`<input type="number" min="1">`，数据绑定到 `form.seriesOrder: number | null`

保存时 SHALL 将 tags、series、seriesOrder 随文章内容一同提交。

#### Scenario: 添加标签
- **WHEN** 管理员在 tags 输入框输入 `cloudflare` 后按回车
- **THEN** `cloudflare` SHALL 以 chip 形式显示，`form.tags` 更新为包含 `"cloudflare"` 的数组

#### Scenario: 删除标签
- **WHEN** 管理员点击某个 tag chip 的 × 按钮
- **THEN** 该标签 SHALL 从 chip 列表与 `form.tags` 中移除

#### Scenario: 填写系列信息后保存文章
- **WHEN** 管理员填写 `series: 'ts-fullstack-ai-chronicle'`、`seriesOrder: 1` 并保存
- **THEN** API 请求体 SHALL 包含 `{ series: "ts-fullstack-ai-chronicle", seriesOrder: 1 }`，文章正确入库

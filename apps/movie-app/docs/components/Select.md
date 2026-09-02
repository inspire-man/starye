# Select

源码：[Select.vue](../../src/components/Select.vue)

## Props

| 属性 | 类型 | 默认值 |
|------|------|--------|
| modelValue | T | 无 |
| options | SelectOption<T>[] | [] |
| placeholder | string | 请选择 |
| size | small、default 或 large | default |
| disabled | boolean | false |
| clearable | boolean | false |
| teleportTo | string | body |
| placement | top 或 bottom | bottom |
| popperClass | string | 空 |
| loading | boolean | false |
| error | boolean | false |

SelectOption 包含 label、value、可选 disabled、icon 和 description。

事件为 update:modelValue、change、visibleChange、clear、blur 和 focus。

~~~vue
<Select
  v-model="selected"
  :options="options"
  placeholder="选择排序方式"
  clearable
/>
~~~

组件会处理外部点击、Escape、下拉定位和 Teleport。组件测试：[Select.test.ts](../../src/components/__tests__/Select.test.ts)

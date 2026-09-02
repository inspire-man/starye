# MobileDrawer

源码：[MobileDrawer.vue](../../src/components/MobileDrawer.vue)

## Props

| 属性 | 类型 | 默认值 |
|------|------|--------|
| modelValue | boolean | false |
| direction | ltr 或 rtl | ltr |
| size | string 或 number | 80vw |
| modal | boolean | true |
| closeOnClickModal | boolean | true |
| closeOnPressEscape | boolean | true |
| lockScroll | boolean | true |
| beforeClose | callback | 无 |
| showClose | boolean | true |
| withHeader | boolean | true |
| title | string | 空 |
| zIndex | number | 2000 |
| customClass | string | 空 |

事件为 update:modelValue、open、opened、close 和 closed。插槽为 header、default 和 footer。组件通过 Teleport 渲染到 body，并在 lockScroll 开启时锁定页面滚动。

~~~vue
<MobileDrawer v-model="visible" title="菜单">
  <nav>...</nav>
</MobileDrawer>
~~~

组件测试：[MobileDrawer.test.ts](../../src/components/__tests__/MobileDrawer.test.ts)

# DrawerFooter

源码：[DrawerFooter.vue](../../src/components/DrawerFooter.vue)

DrawerFooter 没有 Props，也没有自定义事件。组件从 userStore 读取用户和 R18 状态：

- 已登录时显示 R18 状态、用户信息和 signOut 按钮。
- 未登录时显示 signIn 按钮。

组件通常作为 MobileDrawer 的 footer 插槽使用：

~~~vue
<MobileDrawer v-model="visible">
  <template #footer>
    <DrawerFooter />
  </template>
</MobileDrawer>
~~~

组件测试：[DrawerFooter.test.ts](../../src/components/__tests__/DrawerFooter.test.ts)

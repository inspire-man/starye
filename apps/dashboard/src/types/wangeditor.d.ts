// wangEditor for Vue3 (@next) 的类型声明补丁
// 因 package.json exports 字段导致 moduleResolution=bundler 下类型解析失败
declare module '@wangeditor/editor-for-vue' {
  import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
  import type { DefineComponent } from 'vue'

  export const Editor: DefineComponent<{
    modelValue?: string
    defaultConfig?: Partial<IEditorConfig>
    mode?: string
    style?: Record<string, string>
  }>

  export const Toolbar: DefineComponent<{
    editor?: IDomEditor
    defaultConfig?: Partial<IToolbarConfig>
    mode?: string
    class?: string
  }>
}

// wangEditor TypeScript 类型扩展
// 参考：https://www.wangeditor.com/v5/for-ts.html#扩展类型
import type { SlateDescendant } from '@wangeditor/editor'

declare module '@wangeditor/editor' {
  // 扩展 Text
  interface SlateText {
    text: string
  }

  // 扩展 Element
  interface SlateElement {
    type: string
    children: SlateDescendant[]
  }
}

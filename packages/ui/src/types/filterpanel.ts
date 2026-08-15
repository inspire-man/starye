export interface FilterField {
  key: string
  label: string
  type: 'text' | 'select' | 'checkbox' | 'dateRange'
  options?: Array<{ value: string, label: string }>
  placeholder?: string
  /** 在桌面端 3 列网格中跨列数（默认 1，dateRange 建议设为 2） */
  colSpan?: 1 | 2 | 3
  /** 标签与控件的排列方式；未设置时继承 FilterPanel 的配置 */
  labelPosition?: 'top' | 'inline'
}

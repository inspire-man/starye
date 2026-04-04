export interface FilterField {
  key: string
  label: string
  type: 'text' | 'select' | 'checkbox' | 'dateRange'
  options?: Array<{ value: string, label: string }>
  placeholder?: string
}

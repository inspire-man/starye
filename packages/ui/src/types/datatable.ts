export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (item: T) => string
  width?: string
  minWidth?: string
}

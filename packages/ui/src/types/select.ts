export interface SelectOption<TValue = string> {
  label: string
  value: TValue
  disabled?: boolean
  icon?: string
  description?: string
}

export type ApplicationQuestion = {
  id: string
  label: string
  helpText?: string | null
  fieldType: 'text' | 'textarea' | 'select' | 'multiselect' | 'url' | 'file'
  options?: { label: string }[] | null
  required?: boolean | null
  maxLength?: number | null
}

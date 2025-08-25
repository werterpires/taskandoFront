export interface Message {
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  description: string[]
  show: boolean
}

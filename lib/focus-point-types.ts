export type FocusScope = 'day' | 'week' | 'month'
export type FocusContext = 'plan' | 'dagbok'

export interface FocusPoint {
  id: string
  user_id: string
  scope: FocusScope
  period_key: string
  context: FocusContext
  content: string
  sort_order: number
  created_at: string
}

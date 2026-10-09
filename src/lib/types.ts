export type Subtask = {
  id: string
  text: string
  completed: boolean
}

export type Task = {
  id: string
  title: string
  completed: boolean
  dueAt: string | null
  category: string
  notes: string
  subtasks: Subtask[]
  sortOrder: number
  createdAt: string
}

export type CalendarEvent = {
  id: string
  uid: string
  title: string
  startAt: string
  endAt: string | null
}

export type Me = {
  tenantId: string
  icsUrl: string
  prefs: { reminderOffset: number }
}

export function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false
  const task = value as Record<string, unknown>
  if (typeof task.id !== 'string' || typeof task.title !== 'string' || typeof task.completed !== 'boolean') {
    return false
  }
  if (!Array.isArray(task.subtasks)) task.subtasks = []
  if (typeof task.notes !== 'string') task.notes = ''
  if (typeof task.category !== 'string') task.category = 'none'
  if (typeof task.sortOrder !== 'number') task.sortOrder = 0
  return true
}

export function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (typeof value !== 'object' || value === null) return false
  const event = value as Record<string, unknown>
  return typeof event.id === 'string' && typeof event.title === 'string' && typeof event.startAt === 'string'
}

export function isMe(value: unknown): value is Me {
  if (typeof value !== 'object' || value === null) return false
  const me = value as Record<string, unknown>
  return typeof me.tenantId === 'string' && typeof me.icsUrl === 'string'
}

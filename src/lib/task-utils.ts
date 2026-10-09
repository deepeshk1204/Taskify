import type { Subtask, Task } from '@/lib/types'

export function splitDueAt(dueAt: string | null): { date: string; time: string } {
  if (!dueAt) return { date: '', time: '' }
  if (dueAt.includes('T')) {
    const [date, rest] = dueAt.split('T')
    return { date, time: rest.slice(0, 5) }
  }
  return { date: dueAt.slice(0, 10), time: '' }
}

export function joinDueAt(date: string, time: string): string | null {
  if (!date) return null
  return time ? `${date}T${time}:00` : date
}

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function extractTags(text: string): { cleanText: string; tags: string[] } {
  const tags = text.match(/#[\w-]+/g) ?? []
  const cleanText = text.replace(/#[\w-]+/g, '').replace(/\s+/g, ' ').trim()
  return { cleanText: cleanText || text, tags }
}

export function isMeetingTitle(text: string): boolean {
  return /(zoom\.us|meet\.google\.com|teams\.microsoft|webex)/i.test(text)
}

export function dueDatePart(dueAt: string | null): string | null {
  return dueAt ? dueAt.slice(0, 10) : null
}

export function isOverdue(task: Task, today: string): boolean {
  const date = dueDatePart(task.dueAt)
  return Boolean(date && date < today && !task.completed)
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDate = dueDatePart(a.dueAt)
    const bDate = dueDatePart(b.dueAt)
    if (aDate && bDate) {
      if (aDate === bDate) {
        const aTime = splitDueAt(a.dueAt).time
        const bTime = splitDueAt(b.dueAt).time
        if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime)
        return a.sortOrder - b.sortOrder
      }
      return aDate.localeCompare(bDate)
    }
    if (aDate) return -1
    if (bDate) return 1
    return a.sortOrder - b.sortOrder
  })
}

export function asSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.text !== 'string') return []
    return [{ id: row.id, text: row.text, completed: row.completed === true }]
  })
}

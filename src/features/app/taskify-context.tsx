import { useAuth } from '@clerk/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  createTask,
  deleteTask,
  fetchEvents,
  fetchTasks,
  reorderTasks,
  updateTask,
} from '@/lib/api'
import {
  asSubtasks,
  dueDatePart,
  formatDateLocal,
  joinDueAt,
  splitDueAt,
} from '@/lib/task-utils'
import type { CalendarEvent, Task } from '@/lib/types'

export type View = 'list' | 'calendar' | 'settings'
export type Filter = 'all' | 'active' | 'completed'

type TaskifyContextValue = {
  view: View
  setView: (view: View) => void
  filter: Filter
  setFilter: (filter: Filter) => void
  dateFilter: string | null
  setDateFilter: (date: string | null) => void
  composerDate: string
  setComposerDate: (date: string) => void
  tasks: Task[]
  events: CalendarEvent[]
  loading: boolean
  percent: number
  itemsLeft: number
  completedCount: number
  todayLabel: string
  reload: () => Promise<void>
  addTask: (title: string, date: string, time: string, category: string) => Promise<void>
  toggleTask: (task: Task) => Promise<void>
  patchTask: (id: string, patch: Record<string, unknown>) => Promise<void>
  removeTask: (id: string) => Promise<void>
  clearCompleted: () => Promise<void>
  reorderVisible: (ids: string[]) => Promise<void>
}

const TaskifyContext = createContext<TaskifyContextValue | null>(null)

export function TaskifyProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const [view, setView] = useState<View>('list')
  const [filter, setFilter] = useState<Filter>('all')
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [composerDate, setComposerDate] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const withToken = useCallback(async () => {
    const token = await getToken({ skipCache: true })
    if (!token) throw new Error('Sign in required')
    return token
  }, [getToken])

  const reload = useCallback(async () => {
    const token = await withToken()
    const [nextTasks, nextEvents] = await Promise.all([fetchTasks(token), fetchEvents(token)])
    const today = formatDateLocal(new Date())
    const rolled = nextTasks.map((task) => {
      const date = dueDatePart(task.dueAt)
      if (date && date < today && !task.completed) {
        const { time } = splitDueAt(task.dueAt)
        return { ...task, dueAt: joinDueAt(today, time) }
      }
      return { ...task, subtasks: asSubtasks(task.subtasks) }
    })
    const changed = rolled.filter((task, index) => task.dueAt !== nextTasks[index]?.dueAt)
    if (changed.length > 0) {
      await Promise.all(changed.map((task) => updateTask(token, task.id, { dueAt: task.dueAt })))
      toast.message('Tasks rolled over', { description: `${changed.length} overdue task(s) moved to today.` })
    }
    setTasks(rolled)
    setEvents(nextEvents)
    setLoading(false)
  }, [withToken])

  useEffect(() => {
    void reload().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not load tasks')
      setLoading(false)
    })
  }, [reload])

  const scoped = useMemo(() => {
    return dateFilter ? tasks.filter((task) => dueDatePart(task.dueAt) === dateFilter) : tasks
  }, [dateFilter, tasks])

  const percent = scoped.length === 0 ? 0 : Math.round((scoped.filter((task) => task.completed).length / scoped.length) * 100)
  const itemsLeft = scoped.filter((task) => !task.completed).length
  const completedCount = scoped.filter((task) => task.completed).length
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const addTask = useCallback(
    async (title: string, date: string, time: string, category: string) => {
      try {
        const token = await withToken()
        const created = await createTask(token, { title, dueAt: joinDueAt(date, time), category })
        if (created) setTasks((current) => [...current, { ...created, subtasks: asSubtasks(created.subtasks) }])
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Could not save task')
      }
    },
    [withToken],
  )

  const toggleTask = useCallback(
    async (task: Task) => {
      const token = await withToken()
      const updated = await updateTask(token, task.id, { completed: !task.completed })
      if (updated) {
        setTasks((current) =>
          current.map((item) => (item.id === task.id ? { ...updated, subtasks: asSubtasks(updated.subtasks) } : item)),
        )
      }
    },
    [withToken],
  )

  const patchTask = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const token = await withToken()
      const updated = await updateTask(token, id, patch)
      if (updated) {
        setTasks((current) =>
          current.map((item) => (item.id === id ? { ...updated, subtasks: asSubtasks(updated.subtasks) } : item)),
        )
      }
    },
    [withToken],
  )

  const removeTask = useCallback(
    async (id: string) => {
      const token = await withToken()
      await deleteTask(token, id)
      setTasks((current) => current.filter((item) => item.id !== id))
    },
    [withToken],
  )

  const clearCompleted = useCallback(async () => {
    const token = await withToken()
    const done = tasks.filter((task) => task.completed)
    await Promise.all(done.map((task) => deleteTask(token, task.id)))
    setTasks((current) => current.filter((task) => !task.completed))
  }, [tasks, withToken])

  const reorderVisible = useCallback(
    async (ids: string[]) => {
      const token = await withToken()
      await reorderTasks(token, ids)
      setTasks((current) => {
        const byId = new Map(current.map((task) => [task.id, task]))
        return current.map((task) => {
          const index = ids.indexOf(task.id)
          return index === -1 ? task : { ...byId.get(task.id)!, sortOrder: index }
        })
      })
    },
    [withToken],
  )

  const value = useMemo(
    () => ({
      view,
      setView,
      filter,
      setFilter,
      dateFilter,
      setDateFilter,
      composerDate,
      setComposerDate,
      tasks,
      events,
      loading,
      percent,
      itemsLeft,
      completedCount,
      todayLabel,
      reload,
      addTask,
      toggleTask,
      patchTask,
      removeTask,
      clearCompleted,
      reorderVisible,
    }),
    [
      view,
      filter,
      dateFilter,
      composerDate,
      tasks,
      events,
      loading,
      percent,
      itemsLeft,
      completedCount,
      todayLabel,
      reload,
      addTask,
      toggleTask,
      patchTask,
      removeTask,
      clearCompleted,
      reorderVisible,
    ],
  )

  return <TaskifyContext.Provider value={value}>{children}</TaskifyContext.Provider>
}

export function useTaskify() {
  const value = useContext(TaskifyContext)
  if (!value) throw new Error('useTaskify must be used within TaskifyProvider')
  return value
}

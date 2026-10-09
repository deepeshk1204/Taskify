import { Coffee, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTaskify } from '@/features/app/taskify-context'
import { TaskItem } from '@/features/tasks/task-item'
import { dueDatePart, sortTasks } from '@/lib/task-utils'

export function TaskList() {
  const {
    tasks,
    loading,
    filter,
    setFilter,
    dateFilter,
    setDateFilter,
    composerDate,
    setComposerDate,
    itemsLeft,
    completedCount,
    addTask,
    clearCompleted,
    reorderVisible,
  } = useTaskify()
  const [title, setTitle] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [category, setCategory] = useState('none')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const visible = useMemo(() => {
    let next = tasks
    if (dateFilter) next = next.filter((task) => dueDatePart(task.dueAt) === dateFilter)
    if (filter === 'active') next = next.filter((task) => !task.completed)
    if (filter === 'completed') next = next.filter((task) => task.completed)
    return sortTasks(next)
  }, [dateFilter, filter, tasks])

  async function onCreate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    await addTask(trimmed, composerDate, dueTime, category)
    setTitle('')
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <form onSubmit={(event) => void onCreate(event)} className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Plus className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to be done? (Use #tags)"
              className="h-12 rounded-xl bg-white pl-11 text-base shadow-sm"
              required
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm sm:w-auto"
            >
              <option value="none">No Category</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
            </select>
            <div className="flex w-full sm:w-auto">
              <Input
                type="date"
                value={composerDate}
                onChange={(event) => setComposerDate(event.target.value)}
                className="h-12 rounded-l-xl rounded-r-none bg-white shadow-sm"
              />
              <Input
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
                className="h-12 rounded-l-none rounded-r-xl border-l-0 bg-white shadow-sm"
              />
            </div>
            <Button type="submit" className="h-12 rounded-xl px-6">
              Add
            </Button>
          </div>
        </form>
      </div>

      {dateFilter ? (
        <div className="flex shrink-0 items-center justify-between border-b border-blue-100 bg-blue-50 px-6 py-3">
          <span className="text-sm text-blue-700">
            Viewing tasks for:{' '}
            <strong>
              {new Date(`${dateFilter}T00:00:00`).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </strong>
          </span>
          <button
            type="button"
            className="rounded-md p-1 text-blue-500 hover:bg-blue-100"
            onClick={() => setDateFilter(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="text-center text-sm text-slate-500">Loading tasks…</p>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-blue-50">
              <Coffee className="size-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">All caught up!</h3>
            <p className="mt-1 max-w-[250px] text-sm text-slate-500">
              You have no tasks here. Enjoy your day or add a new task above.
            </p>
          </div>
        ) : (
          <ul className="mx-auto w-full max-w-4xl space-y-2 pb-20">
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onDragStart={setDraggedId}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event, targetId) => {
                  event.preventDefault()
                  if (!draggedId || draggedId === targetId) return
                  const ids = visible.map((item) => item.id)
                  const from = ids.indexOf(draggedId)
                  const to = ids.indexOf(targetId)
                  if (from < 0 || to < 0) return
                  const next = [...ids]
                  next.splice(from, 1)
                  next.splice(to, 0, draggedId)
                  void reorderVisible(next)
                  setDraggedId(null)
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <footer className="flex shrink-0 flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row">
        <span className="text-sm font-medium text-slate-500">
          {itemsLeft} item{itemsLeft === 1 ? '' : 's'} left
        </span>
        <div className="flex max-w-full space-x-1 overflow-x-auto rounded-lg bg-slate-200/50 p-1">
          {(['all', 'active', 'completed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                filter === value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        {completedCount > 0 ? (
          <button
            type="button"
            className="text-sm font-medium text-slate-500 hover:text-rose-600"
            onClick={() => void clearCompleted()}
          >
            Clear completed
          </button>
        ) : (
          <span className="hidden w-28 sm:block" />
        )}
      </footer>
    </div>
  )
}

import {
  Briefcase,
  Calendar,
  ChevronRight,
  GitMerge,
  House,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useTaskify } from '@/features/app/taskify-context'
import { dueDatePart, extractTags, isMeetingTitle, isOverdue, splitDueAt } from '@/lib/task-utils'
import type { Subtask, Task } from '@/lib/types'

export function TaskItem({
  task,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  task: Task
  onDragStart: (id: string) => void
  onDragOver: (event: React.DragEvent, id: string) => void
  onDrop: (event: React.DragEvent, id: string) => void
}) {
  const { toggleTask, patchTask, removeTask } = useTaskify()
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [subDraft, setSubDraft] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const { cleanText, tags } = extractTags(task.title)
  const { date, time } = splitDueAt(task.dueAt)
  const overdue = isOverdue(task, today)
  const subDone = task.subtasks.filter((sub) => sub.completed).length
  const meeting = isMeetingTitle(task.title)

  async function commitTitle() {
    const next = title.trim()
    if (next && next !== task.title) await patchTask(task.id, { title: next })
    else setTitle(task.title)
  }

  async function addSubtask() {
    const text = subDraft.trim()
    if (!text) return
    const next: Subtask[] = [...task.subtasks, { id: crypto.randomUUID(), text, completed: false }]
    setSubDraft('')
    await patchTask(task.id, { subtasks: next })
  }

  return (
    <li
      draggable
      data-id={task.id}
      onDragStart={() => onDragStart(task.id)}
      onDragOver={(event) => onDragOver(event, task.id)}
      onDrop={(event) => onDrop(event, task.id)}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-300"
    >
      <div className="flex w-full cursor-grab items-center justify-between p-3 active:cursor-grabbing">
        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
          <button
            type="button"
            className="mr-1 flex size-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronRight className={`size-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => void toggleTask(task)}
            className="mr-3 size-5 rounded-full"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={title}
                disabled={task.completed}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void commitTitle()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                className={`min-w-0 flex-1 bg-transparent text-base outline-none ${
                  task.completed ? 'text-slate-400 line-through' : 'font-medium text-slate-700'
                }`}
              />
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    task.completed
                      ? 'bg-slate-100 text-slate-400'
                      : 'border border-blue-100 bg-blue-50 text-blue-600'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {task.category === 'work' ? (
                <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                  <Briefcase className="size-3" /> Work
                </span>
              ) : null}
              {task.category === 'personal' ? (
                <span className="flex items-center gap-1 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-700">
                  <House className="size-3" /> Personal
                </span>
              ) : null}
              {meeting ? (
                <span className="flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">
                  <Video className="size-3" /> Meeting
                </span>
              ) : null}
              {date ? (
                <span
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                    task.completed
                      ? 'bg-slate-100 text-slate-400'
                      : overdue
                        ? 'bg-rose-100 font-bold text-rose-600'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Calendar className="size-3" />
                  {new Date(`${dueDatePart(task.dueAt)}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {time ? ` @ ${time}` : ''}
                </span>
              ) : null}
              {task.subtasks.length > 0 || task.notes ? (
                <span
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    task.subtasks.length > 0 && subDone === task.subtasks.length
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {task.subtasks.length > 0 ? (
                    <>
                      <GitMerge className="size-3" /> {subDone}/{task.subtasks.length}
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
            <span className="sr-only">{cleanText}</span>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-1.5 text-slate-400 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={() => void removeTask(task.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {expanded ? (
        <div className="flex cursor-default flex-col gap-3 border-t border-slate-100 bg-slate-50/50 py-3 pr-3 pb-4 pl-[3.25rem]">
          <div className="flex flex-col gap-1">
            {task.subtasks.map((sub) => (
              <div key={sub.id} className="group/sub flex items-center justify-between py-0.5">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <Checkbox
                    checked={sub.completed}
                    onCheckedChange={() => {
                      const next = task.subtasks.map((item) =>
                        item.id === sub.id ? { ...item, completed: !item.completed } : item,
                      )
                      void patchTask(task.id, { subtasks: next })
                    }}
                  />
                  <span className={`truncate text-sm ${sub.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                    {sub.text}
                  </span>
                </label>
                <button
                  type="button"
                  className="rounded p-0.5 text-slate-300 opacity-0 hover:text-rose-500 group-hover/sub:opacity-100"
                  onClick={() =>
                    void patchTask(task.id, { subtasks: task.subtasks.filter((item) => item.id !== sub.id) })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void addSubtask()
              }}
            >
              <Plus className="size-4 shrink-0 text-slate-300" />
              <input
                value={subDraft}
                onChange={(event) => setSubDraft(event.target.value)}
                placeholder="Add subtask..."
                className="flex-1 border-none bg-transparent py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </form>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Description / Notes
            </label>
            <Textarea
              defaultValue={task.notes}
              placeholder="Add details..."
              className="min-h-[60px] resize-none bg-white shadow-sm"
              onBlur={(event) => {
                if (event.target.value !== task.notes) void patchTask(task.id, { notes: event.target.value })
              }}
            />
          </div>
        </div>
      ) : null}
    </li>
  )
}

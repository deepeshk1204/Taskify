import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTaskify } from '@/features/app/taskify-context'
import { dueDatePart, formatDateLocal, isMeetingTitle, splitDueAt } from '@/lib/task-utils'

export function CalendarView() {
  const { tasks, events, setView, setDateFilter, setComposerDate } = useTaskify()
  const now = useState(() => new Date())[0]
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstDay + lastDay) / 7) * 7
  const title = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  function openDay(date: Date) {
    const key = formatDateLocal(date)
    setComposerDate(key)
    setDateFilter(key)
    setView('list')
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/30">
        <div className="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-white">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div
              key={label}
              className="py-2 text-center text-[10px] font-semibold tracking-wider text-slate-500 uppercase sm:text-xs"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-fr grid-cols-7 grid-rows-5 gap-px overflow-y-auto bg-slate-200 sm:grid-rows-6">
          {Array.from({ length: totalCells }, (_, index) => {
            const date = new Date(year, month, index - firstDay + 1)
            const inMonth = date.getMonth() === month
            const key = formatDateLocal(date)
            const isToday = key === formatDateLocal(now)
            const dayTasks = tasks
              .filter((task) => dueDatePart(task.dueAt) === key)
              .sort((a, b) => (splitDueAt(a.dueAt).time || '24:00').localeCompare(splitDueAt(b.dueAt).time || '24:00'))
            const dayEvents = events.filter((event) => event.startAt.startsWith(key))
            return (
              <button
                key={`${key}-${index}`}
                type="button"
                onClick={() => openDay(date)}
                className={`flex min-h-[80px] flex-col p-1 text-left sm:min-h-[100px] sm:p-2 ${
                  inMonth ? 'bg-white text-slate-700 hover:bg-slate-50' : 'bg-slate-50 text-slate-400'
                }`}
              >
                <span
                  className={`mb-1 flex size-6 items-center justify-center rounded-full text-sm font-medium ${
                    isToday ? 'bg-blue-600 text-white' : ''
                  }`}
                >
                  {date.getDate()}
                </span>
                <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                  {dayTasks.map((task) => {
                    const meeting = isMeetingTitle(task.title)
                    const time = splitDueAt(task.dueAt).time
                    return (
                      <span
                        key={task.id}
                        className={`truncate rounded border-l-2 px-1 py-0.5 text-[9px] sm:px-1.5 sm:text-[10px] ${
                          task.completed
                            ? 'border-slate-300 bg-slate-100 text-slate-500 line-through opacity-60'
                            : meeting
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-blue-500 bg-blue-50 text-blue-700'
                        }`}
                      >
                        {time ? `${time} ` : ''}
                        {task.title}
                      </span>
                    )
                  })}
                  {dayEvents.map((event) => (
                    <span
                      key={event.id}
                      className="truncate rounded border-l-2 border-purple-500 bg-purple-50 px-1 py-0.5 text-[9px] text-purple-700 sm:px-1.5 sm:text-[10px]"
                    >
                      {event.title}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

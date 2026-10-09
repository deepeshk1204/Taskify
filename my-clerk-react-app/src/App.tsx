import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { CalendarDays, CheckCircle2, List, Settings } from 'lucide-react'
import { CommandPalette } from '@/features/app/command-palette'
import { TaskifyProvider, useTaskify } from '@/features/app/taskify-context'
import { CalendarView } from '@/features/calendar/calendar-view'
import { SettingsView } from '@/features/settings/settings-view'
import { TaskList } from '@/features/tasks/task-list'

export default function App() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#f5f5f7] p-2 sm:p-4">
      <Show when="signed-out">
        <SignedOutCard />
      </Show>
      <Show when="signed-in">
        <TaskifyProvider>
          <TaskifyShell />
        </TaskifyProvider>
      </Show>
    </div>
  )
}

function SignedOutCard() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-10 text-center shadow-xl ring-1 ring-slate-200">
      <CheckCircle2 className="size-10 text-blue-600" />
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Taskify</h1>
      <p className="text-sm text-slate-500">Sign in to plan your day with tasks, calendar, and meetings.</p>
      <div className="flex gap-2">
        <SignInButton mode="modal">
          <button type="button" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Sign up
          </button>
        </SignUpButton>
      </div>
    </div>
  )
}

function TaskifyShell() {
  const { view, setView, percent, todayLabel } = useTaskify()

  return (
    <main className="mx-auto flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 sm:h-[88vh]">
      <header className="z-10 flex shrink-0 flex-col justify-between gap-4 border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-md sm:flex-row sm:items-center">
        <div className="flex w-full items-center justify-between sm:w-auto">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <CheckCircle2 className="size-8 text-blue-600" />
              Taskify
            </h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>{todayLabel}</span>
              <span
                className="cursor-help rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
                title="Press Cmd+K or Ctrl+K"
              >
                Cmd+K
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3 sm:hidden">
            <p className="text-xl font-bold text-blue-600">{percent}%</p>
            <UserButton />
          </div>
        </div>

        <div className="flex w-full justify-center self-center rounded-lg bg-slate-100 p-1 sm:w-auto sm:self-auto">
          <ViewButton active={view === 'list'} onClick={() => setView('list')} icon={<List className="size-4" />}>
            List
          </ViewButton>
          <ViewButton
            active={view === 'calendar'}
            onClick={() => setView('calendar')}
            icon={<CalendarDays className="size-4" />}
          >
            Calendar
          </ViewButton>
          <ViewButton
            active={view === 'settings'}
            onClick={() => setView('settings')}
            icon={<Settings className="size-4" />}
          >
            Settings
          </ViewButton>
        </div>

        <div className="hidden items-center gap-4 sm:flex">
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{percent}%</p>
            <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">Completed</p>
          </div>
          <UserButton />
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden bg-white">
        {view === 'list' ? <TaskList /> : null}
        {view === 'calendar' ? <CalendarView /> : null}
        {view === 'settings' ? <SettingsView /> : null}
      </div>
      <CommandPalette />
    </main>
  )
}

function ViewButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all sm:flex-none ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

import { useAuth } from '@clerk/react'
import { Bell, Database } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTaskify } from '@/features/app/taskify-context'
import { createTask, fetchMe, importIcs, syncCalendar, updateMe } from '@/lib/api'
import { joinDueAt } from '@/lib/task-utils'

export function SettingsView() {
  const { getToken } = useAuth()
  const { tasks, reload } = useTaskify()
  const [icsUrl, setIcsUrl] = useState('')
  const [reminderOffset, setReminderOffset] = useState(5)
  const [notifyLabel, setNotifyLabel] = useState('Enable')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    void (async () => {
      const token = await getToken({ skipCache: true })
      if (!token) return
      const me = await fetchMe(token)
      if (!me) return
      setIcsUrl(me.icsUrl)
      setReminderOffset(me.prefs.reminderOffset)
    })().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not load settings')
    })
  }, [getToken])

  async function persist(nextUrl = icsUrl, nextOffset = reminderOffset) {
    const token = await getToken({ skipCache: true })
    if (!token) return
    await updateMe(token, { icsUrl: nextUrl, prefs: { reminderOffset: nextOffset } })
  }

  async function syncNow() {
    setSyncing(true)
    try {
      await persist()
      const token = await getToken({ skipCache: true })
      if (!token) return
      const upserted = await syncCalendar(token)
      await reload()
      toast.success('Calendar synced', { description: `${upserted} events updated.` })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function exportJson() {
    const blob = new Blob([JSON.stringify({ tasks }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'taskify-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onImportJson(file: File) {
    const parsed: unknown = JSON.parse(await file.text())
    const token = await getToken({ skipCache: true })
    if (!token) return
    const rows = extractImportedTasks(parsed)
    for (const row of rows) {
      await createTask(token, row)
    }
    await reload()
    toast.success('Restore complete', { description: `${rows.length} tasks imported.` })
  }

  async function onImportIcs(file: File) {
    const token = await getToken({ skipCache: true })
    if (!token) return
    const upserted = await importIcs(token, await file.text())
    await reload()
    toast.success('Calendar uploaded', { description: `${upserted} events imported.` })
  }

  function enableNotifications() {
    if (!('Notification' in window)) {
      toast.error('Notifications are not supported in this browser')
      return
    }
    void Notification.requestPermission().then((permission) => {
      setNotifyLabel(permission === 'granted' ? 'Enabled' : 'Enable')
      toast.message(permission === 'granted' ? 'Notifications enabled' : 'Permission not granted')
    })
  }

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6 pb-20">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Settings & Data</h2>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <Bell className="size-5 text-blue-500" /> Notifications
          </h3>
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Browser Notifications</p>
              <p className="mt-1 text-xs text-slate-500">Allow Taskify to send notifications for due tasks.</p>
            </div>
            <Button variant="secondary" onClick={enableNotifications}>
              {notifyLabel}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Default Reminder Time</p>
              <p className="mt-1 text-xs text-slate-500">When should we notify you before a task's time?</p>
            </div>
            <select
              value={String(reminderOffset)}
              onChange={(event) => {
                const value = Number(event.target.value)
                setReminderOffset(value)
                void persist(icsUrl, value)
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <option value="0">At time of event</option>
              <option value="5">5 mins before</option>
              <option value="15">15 mins before</option>
              <option value="30">30 mins before</option>
              <option value="-1">Disabled</option>
            </select>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <Database className="size-5 text-blue-500" /> Backup & Sync
          </h3>
          <Row
            title="Backup Data"
            hint="Export your tasks to a JSON file."
            action={
              <Button variant="secondary" onClick={() => void exportJson()}>
                Export JSON
              </Button>
            }
          />
          <Row
            title="Restore Data"
            hint="Import tasks from a JSON backup."
            action={
              <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200">
                Import JSON
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void onImportJson(file)
                  }}
                />
              </label>
            }
          />
          <div className="mb-4 flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-slate-700">Calendar (.ics URL)</p>
              <p className="mt-1 max-w-[280px] text-xs text-slate-500">
                Paste a private iCal URL. Sync is manual for now.
              </p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                type="url"
                value={icsUrl}
                onChange={(event) => setIcsUrl(event.target.value)}
                onBlur={() => void persist()}
                placeholder="https://...basic.ics"
                className="flex-1 bg-slate-50 sm:w-64"
              />
              <Button onClick={() => void syncNow()} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync'}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">
                Manual Calendar Upload{' '}
                <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                  Secure
                </span>
              </p>
              <p className="mt-1 max-w-[280px] text-xs text-slate-500">Upload an exported .ics file.</p>
            </div>
            <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Upload .ics
              <input
                type="file"
                accept=".ics"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void onImportIcs(file)
                }}
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}

function Row({ title, hint, action }: { title: string; hint: string; action: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>
      {action}
    </div>
  )
}

function extractImportedTasks(parsed: unknown): Array<{ title: string; dueAt: string | null; category: string; notes: string }> {
  if (typeof parsed !== 'object' || parsed === null) return []
  const record = parsed as Record<string, unknown>
  const list = Array.isArray(record.tasks) ? record.tasks : Array.isArray(record.todos) ? record.todos : []
  return list.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as Record<string, unknown>
    const title = typeof row.title === 'string' ? row.title : typeof row.text === 'string' ? row.text : ''
    if (!title) return []
    const dueDate = typeof row.dueDate === 'string' ? row.dueDate : ''
    const dueTime = typeof row.dueTime === 'string' ? row.dueTime : ''
    const dueAt =
      typeof row.dueAt === 'string' || row.dueAt === null
        ? (row.dueAt as string | null)
        : joinDueAt(dueDate, dueTime)
    return [
      {
        title,
        dueAt,
        category: typeof row.category === 'string' ? row.category : 'none',
        notes: typeof row.notes === 'string' ? row.notes : '',
      },
    ]
  })
}

import { CheckCircle2, Circle, PlusCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useTaskify } from '@/features/app/taskify-context'

export function CommandPalette() {
  const { tasks, addTask, toggleTask } = useTaskify()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const matches = useMemo(() => {
    const needle = query.toLowerCase().trim()
    if (!needle) return []
    return tasks
      .filter((task) => task.title.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [query, tasks])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
      <CommandInput
        placeholder="Search tasks or type to create new..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim() ? (
          <>
            {matches.length > 0 ? (
              <CommandGroup heading="Found Tasks">
                {matches.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={task.title}
                    onSelect={() => {
                      void toggleTask(task)
                      setOpen(false)
                    }}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <Circle className="size-4 text-slate-300" />
                    )}
                    <span className="truncate">{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>No matching tasks</CommandEmpty>
            )}
            <CommandGroup>
              <CommandItem
                value={`create-${query}`}
                onSelect={() => {
                  void addTask(query.trim(), '', '', 'none')
                  setOpen(false)
                  setQuery('')
                }}
              >
                <PlusCircle className="size-4 text-blue-600" />
                Create new task: “{query.trim()}”
              </CommandItem>
            </CommandGroup>
          </>
        ) : (
          <CommandEmpty>Type to search or create a task</CommandEmpty>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}

export type ParsedEvent = {
  uid: string
  title: string
  startAt: string
  endAt: string | null
}

export function parseIcsEvents(icsData: string): ParsedEvent[] {
  const unfolded = icsData.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)
  const events: ParsedEvent[] = []
  let inEvent = false
  let summary = ''
  let uid = ''
  let startAt = ''
  let endAt: string | null = null

  const reset = () => {
    inEvent = false
    summary = ''
    uid = ''
    startAt = ''
    endAt = null
  }

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true
      summary = ''
      uid = ''
      startAt = ''
      endAt = null
      continue
    }
    if (line.startsWith('END:VEVENT')) {
      if (inEvent && summary && startAt) {
        events.push({
          uid: uid || `${summary}:${startAt}`,
          title: unescapeIcs(summary),
          startAt,
          endAt,
        })
      }
      reset()
      continue
    }
    if (!inEvent) continue

    const match = line.match(/^([^;:]+)(?:;([^:]*))?:(.*)$/)
    if (!match) continue
    const key = match[1]
    const value = match[3] ?? ''

    if (key === 'SUMMARY') summary = value
    if (key === 'UID') uid = value
    if (key === 'DTSTART') startAt = icsDateToIso(value)
    if (key === 'DTEND') endAt = icsDateToIso(value)
  }

  return events
}

function unescapeIcs(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function icsDateToIso(value: string): string {
  const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/)
  if (!dateMatch) return value
  const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
  if (dateMatch[4] && dateMatch[5]) {
    return `${date}T${dateMatch[4]}:${dateMatch[5]}:00`
  }
  return date
}

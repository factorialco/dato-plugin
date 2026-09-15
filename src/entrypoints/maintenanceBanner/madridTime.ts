/**
 * Maintenance windows are always Spanish time.
 *
 * The team scheduling the work is in Madrid, so that is the clock everyone
 * agrees on — an admin types the time they mean, and every editor is shown the
 * same instant in the same words, whichever market or timezone they are in.
 * Because of that, the rendered time is always labelled: an editor in Nairobi
 * reading a bare "14:00" would otherwise reasonably take it for their own.
 *
 * The stored value stays a UTC ISO instant, which is unambiguous and survives
 * the DST changes Madrid goes through twice a year (CET in winter, CEST in
 * summer). This module owns the conversion at both edges — nothing else should
 * be doing timezone arithmetic.
 */

export const MAINTENANCE_TIME_ZONE = 'Europe/Madrid'
export const MAINTENANCE_TIME_ZONE_LABEL = 'Madrid time'

const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE

type WallClock = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
}

// `h23` rather than `hour12: false`, which renders midnight as "24" in some
// engines.
const wallClockFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MAINTENANCE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})

/** What a Madrid clock reads at this instant. */
const wallClockOf = (date: Date): WallClock => {
  const parts = wallClockFormatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute')
  }
}

/** The same wall clock read as though it were UTC. */
const asIfUtc = (wall: WallClock): number =>
  Date.UTC(
    Number(wall.year),
    Number(wall.month) - 1,
    Number(wall.day),
    Number(wall.hour),
    Number(wall.minute)
  )

/** Madrid's offset from UTC at an instant: +1h in winter, +2h in summer. */
const offsetAt = (ms: number): number =>
  asIfUtc(wallClockOf(new Date(ms))) -
  Math.floor(ms / MS_PER_MINUTE) * MS_PER_MINUTE

const isValid = (date: Date): boolean => !Number.isNaN(date.getTime())

/** `YYYY-MM-DDTHH:mm` in Madrid, ready for a `datetime-local` input. */
export const toMadridInput = (iso: string): string => {
  if (!iso) {
    return ''
  }

  const date = new Date(iso)

  if (!isValid(date)) {
    return ''
  }

  const wall = wallClockOf(date)

  return `${wall.year}-${wall.month}-${wall.day}T${wall.hour}:${wall.minute}`
}

/** The UTC instant for a `YYYY-MM-DDTHH:mm` the admin typed as Madrid time. */
export const fromMadridInput = (value: string): string => {
  if (!value) {
    return ''
  }

  const [date, time = ''] = value.split('T')
  const naive = Date.parse(`${date}T${time.slice(0, 5)}:00.000Z`)

  if (Number.isNaN(naive)) {
    return ''
  }

  // Two passes: the first offset is read at an instant up to two hours off,
  // which lands on the wrong side of a DST change for windows near one. The
  // corrected instant then yields the offset that actually applies.
  const firstPass = naive - offsetAt(naive)

  return new Date(naive - offsetAt(firstPass)).toISOString()
}

/** Madrid's calendar day, as a day number, for comparing dates. */
export const madridDayNumber = (date: Date): number => {
  const wall = wallClockOf(date)

  return (
    Date.UTC(Number(wall.year), Number(wall.month) - 1, Number(wall.day)) /
    MS_PER_DAY
  )
}

/** `HH:mm` on a Madrid clock. */
export const madridTimeOf = (date: Date): string => {
  const wall = wallClockOf(date)

  return `${wall.hour}:${wall.minute}`
}

export const madridWeekdayOf = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    timeZone: MAINTENANCE_TIME_ZONE,
    weekday: 'long'
  })

export const madridDateOf = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    timeZone: MAINTENANCE_TIME_ZONE,
    dateStyle: 'medium'
  })

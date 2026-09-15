import type { PluginParameters } from '../../lib/pluginParameters'

export type MaintenanceWindow = {
  message: string
  startsAt: string
}

/**
 * The maintenance window to announce, or null when there is nothing to show.
 *
 * A window only counts when it is switched on and complete: an enabled banner
 * with a blank message or an unparseable start time is treated as not
 * configured rather than shown half-rendered.
 */
export const getMaintenanceWindow = (
  parameters: Pick<
    PluginParameters,
    'maintenanceEnabled' | 'maintenanceMessage' | 'maintenanceStartsAt'
  >
): MaintenanceWindow | null => {
  const { maintenanceEnabled, maintenanceMessage, maintenanceStartsAt } =
    parameters

  if (!maintenanceEnabled) {
    return null
  }

  if (!maintenanceMessage || !maintenanceStartsAt) {
    return null
  }

  if (Number.isNaN(new Date(maintenanceStartsAt).getTime())) {
    return null
  }

  return {
    message: maintenanceMessage,
    startsAt: maintenanceStartsAt
  }
}

// Placeholder admins can drop anywhere in the message to control where the
// start time appears (e.g. "...scheduled maintenance {startsAt} on..."). If
// it's not used, the start time is appended at the end instead.
export const START_PLACEHOLDER = '{startsAt}'

/** Midnight of `date`'s own calendar day, in the reader's timezone. */
const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * The start time as a reader would say it — "Today at 09:00", "Tomorrow at
 * 14:30", "Monday at 08:00", "12 Oct 2026 at 08:00".
 *
 * Nearby days read as words because that is what makes the notice land: an
 * editor skims "Today at 14:00" far faster than a date they have to decode.
 * Beyond the coming week the relative form stops helping ("in 23 days"), so it
 * falls back to a plain date.
 *
 * Both parts render in the reader's own locale and timezone, converted from
 * the UTC value stored in the plugin parameters.
 */
export const formatMaintenanceStart = (
  startsAt: string,
  now: Date = new Date()
): string => {
  const date = new Date(startsAt)
  // `Math.round` rather than a floor: across a DST boundary the two midnights
  // are 23 or 25 hours apart, which would otherwise shift the day by one.
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / MS_PER_DAY)

  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

  const day = (): string => {
    if (dayDiff === 0) {
      return 'Today'
    }

    if (dayDiff === 1) {
      return 'Tomorrow'
    }

    if (dayDiff === -1) {
      return 'Yesterday'
    }

    if (dayDiff > 1 && dayDiff < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'long' })
    }

    return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
  }

  return `${day()} at ${time}`
}

/**
 * The notice as the reader sees it.
 *
 * Where the message uses `{startsAt}` the time is substituted bare, so it can
 * open a sentence ("Today at 09:00, we'll be performing..."). Messages that do
 * not mention it get the time appended in parentheses instead, so the
 * information is never simply lost.
 */
export const buildBannerText = (
  maintenanceWindow: MaintenanceWindow,
  now: Date = new Date()
): string => {
  const formattedStartsAt = formatMaintenanceStart(
    maintenanceWindow.startsAt,
    now
  )

  return maintenanceWindow.message.includes(START_PLACEHOLDER)
    ? maintenanceWindow.message.replaceAll(START_PLACEHOLDER, formattedStartsAt)
    : `${maintenanceWindow.message} (starts at ${formattedStartsAt})`
}

/**
 * Splits the message for display: blank lines separate paragraphs, single
 * newlines are line breaks within one (a sign-off, typically).
 */
export const toParagraphs = (text: string): string[][] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
    )
    .filter((lines) => lines.length > 0)

// <input type="datetime-local"> always reports "YYYY-MM-DDTHH:mm" regardless of
// locale, so these round-trip cleanly with the "YYYY-MM-DDTHH:mm:00.000Z" (UTC)
// strings stored in the plugin parameters. The value is used as-is — no
// timezone conversion — so what an admin types is exactly what gets stored,
// which is what lets the field be labelled UTC honestly.
export const toDateTimeInput = (iso: string): string =>
  iso ? iso.replace(/Z$/, '').slice(0, 16) : ''

export const fromDateTimeInput = (value: string): string => {
  if (!value) {
    return ''
  }

  const [date, time = ''] = value.split('T')

  return `${date}T${time.slice(0, 5)}:00.000Z`
}

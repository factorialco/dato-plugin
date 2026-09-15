import type { PluginParameters } from '../../lib/pluginParameters'
import {
  MAINTENANCE_TIME_ZONE_LABEL,
  fromMadridInput,
  madridDateOf,
  madridDayNumber,
  madridTimeOf,
  madridWeekdayOf,
  toMadridInput
} from './madridTime'

/** Ids for the notice surfaces, kept here so headless code can reference them. */
export const MAINTENANCE_MODAL_ID = 'maintenanceNotice'
export const MAINTENANCE_OUTLET_ID = 'maintenanceNotice'

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

/**
 * The start time as a reader would say it — "Today at 09:00 (Madrid time)",
 * "Tomorrow at 14:30 (Madrid time)", "Monday at 08:00 (Madrid time)",
 * "12 Oct 2026 at 08:00 (Madrid time)".
 *
 * Nearby days read as words because that is what makes the notice land: an
 * editor skims "Today at 14:00" far faster than a date they have to decode.
 * Beyond the coming week the relative form stops helping ("in 23 days"), so it
 * falls back to a plain date.
 *
 * Every part is Madrid's — including which day counts as "today", so the words
 * and the clock never disagree — and the zone is always named, since most
 * readers are not in it.
 */
export const formatMaintenanceStart = (
  startsAt: string,
  now: Date = new Date()
): string => {
  const date = new Date(startsAt)
  const dayDiff = madridDayNumber(date) - madridDayNumber(now)

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
      return madridWeekdayOf(date)
    }

    return madridDateOf(date)
  }

  return `${day()} at ${madridTimeOf(date)} (${MAINTENANCE_TIME_ZONE_LABEL})`
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

// The input is Madrid time, not UTC: `madridTime` owns the conversion, and
// the stored value stays a UTC instant.
export const toDateTimeInput = (iso: string): string => toMadridInput(iso)

export const fromDateTimeInput = (value: string): string =>
  fromMadridInput(value)

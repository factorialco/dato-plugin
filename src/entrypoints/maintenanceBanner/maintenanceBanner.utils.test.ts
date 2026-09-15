import { describe, expect, it } from 'vitest'
import {
  buildBannerText,
  formatMaintenanceStart,
  fromDateTimeInput,
  getMaintenanceWindow,
  toDateTimeInput,
  toParagraphs
} from './maintenanceBanner.utils'

describe(getMaintenanceWindow, () => {
  it('returns null when maintenance is not enabled', () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: false,
        maintenanceMessage: 'Maintenance!',
        maintenanceStartsAt: '2026-07-10T08:00:00.000Z'
      })
    ).toBeNull()
  })

  it('returns null when the message is missing', () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: '',
        maintenanceStartsAt: '2026-07-10T08:00:00.000Z'
      })
    ).toBeNull()
  })

  it('returns null when the start date/time is missing', () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: 'Maintenance!',
        maintenanceStartsAt: ''
      })
    ).toBeNull()
  })

  it('returns null when the start date/time is malformed', () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: 'Maintenance!',
        maintenanceStartsAt: 'not-a-date'
      })
    ).toBeNull()
  })

  it('returns the window when enabled and valid', () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: 'Maintenance!',
        maintenanceStartsAt: '2026-07-10T08:00:00.000Z'
      })
    ).toStrictEqual({
      message: 'Maintenance!',
      startsAt: '2026-07-10T08:00:00.000Z'
    })
  })
})

describe(buildBannerText, () => {
  // Assertions use toContain rather than an exact string: toLocaleString's
  // output depends on the machine's locale/timezone, which varies between
  // dev machines and CI.
  it("appends the formatted start time to the message when there's no placeholder", () => {
    const text = buildBannerText({
      message: 'Maintenance!',
      startsAt: '2026-07-10T08:00:00.000Z'
    })

    expect(text).toMatch(/^Maintenance! \(starts at .+\)$/)
  })

  it('inserts the start time bare in place of the {startsAt} placeholder', () => {
    const text = buildBannerText(
      {
        message: '{startsAt}, we will be performing maintenance.',
        startsAt: '2026-07-10T08:00:00.000Z'
      },
      new Date('2026-07-10T06:00:00.000Z')
    )

    // Bare, not parenthesised: the placeholder often opens the sentence.
    expect(text).toMatch(/^Today at .+, we will be performing maintenance\.$/)
    expect(text).not.toContain('{startsAt}')
  })

  it('replaces every occurrence of the placeholder', () => {
    const text = buildBannerText(
      {
        message: '{startsAt} and again {startsAt}',
        startsAt: '2026-07-10T08:00:00.000Z'
      },
      new Date('2026-07-10T06:00:00.000Z')
    )

    expect(text).not.toContain('{startsAt}')
  })
})

describe(formatMaintenanceStart, () => {
  // A fixed "now" keeps these deterministic; the day words are what matter,
  // since the time half renders in the machine's own locale.
  const now = new Date('2026-07-10T12:00:00.000Z')

  it.each([
    ['2026-07-10T08:00:00.000Z', 'Today'],
    ['2026-07-11T08:00:00.000Z', 'Tomorrow'],
    ['2026-07-09T08:00:00.000Z', 'Yesterday']
  ])('describes %s as %s', (startsAt, expected) => {
    expect(formatMaintenanceStart(startsAt, now)).toContain(expected)
  })

  it('names the weekday for a day later this week', () => {
    expect(formatMaintenanceStart('2026-07-13T08:00:00.000Z', now)).toMatch(
      /^Monday at /
    )
  })

  it('falls back to a plain date further out', () => {
    const text = formatMaintenanceStart('2026-09-01T08:00:00.000Z', now)

    expect(text).not.toMatch(/Today|Tomorrow|Yesterday/)
    expect(text).toContain('2026')
  })

  it('always states a time', () => {
    expect(formatMaintenanceStart('2026-07-10T08:00:00.000Z', now)).toMatch(
      / at \d{1,2}[:.]\d{2}/
    )
  })
})

describe(toParagraphs, () => {
  it('splits on blank lines and keeps line breaks within a paragraph', () => {
    expect(toParagraphs('One.\n\nTwo.\nStill two.')).toStrictEqual([
      ['One.'],
      ['Two.', 'Still two.']
    ])
  })

  it('drops empty paragraphs and surrounding whitespace', () => {
    expect(toParagraphs('\n\n  One.  \n\n\n\n')).toStrictEqual([['One.']])
  })
})

describe('datetime-local round trip', () => {
  // The conversion itself is covered in madridTime.test.ts; these check that
  // the utils surface carries Madrid semantics rather than UTC.
  it('survives a round trip unchanged', () => {
    const stored = '2026-07-10T08:30:00.000Z'

    expect(fromDateTimeInput(toDateTimeInput(stored))).toBe(stored)
  })

  it('renders a stored instant on a Madrid clock, not a UTC one', () => {
    expect(toDateTimeInput('2026-07-10T08:30:00.000Z')).toBe('2026-07-10T10:30')
  })

  // Regression: the field used to be a separate date and a separate time, and
  // recombining them wiped the value whenever only one had been picked.
  // A single input has no half-filled state to lose.
  it('keeps a value typed into the input, reading it as Madrid time', () => {
    expect(fromDateTimeInput('2026-07-10T10:30')).toBe(
      '2026-07-10T08:30:00.000Z'
    )
  })

  it('maps empty both ways', () => {
    expect(toDateTimeInput('')).toBe('')
    expect(fromDateTimeInput('')).toBe('')
  })
})

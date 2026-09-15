import { describe, expect, it } from 'vitest'
import {
  fromMadridInput,
  madridDayNumber,
  madridTimeOf,
  toMadridInput
} from './madridTime'

describe(fromMadridInput, () => {
  it('reads winter input as CET (UTC+1)', () => {
    expect(fromMadridInput('2026-01-15T10:00')).toBe('2026-01-15T09:00:00.000Z')
  })

  it('reads summer input as CEST (UTC+2)', () => {
    expect(fromMadridInput('2026-07-10T10:00')).toBe('2026-07-10T08:00:00.000Z')
  })

  // Madrid springs forward at 02:00 on 29 March 2026 and falls back at 03:00
  // on 25 October 2026. A single-pass offset lookup lands on the wrong side of
  // these.
  it('resolves a time just before the spring-forward change', () => {
    expect(fromMadridInput('2026-03-29T01:30')).toBe('2026-03-29T00:30:00.000Z')
  })

  it('resolves a time just after the spring-forward change', () => {
    expect(fromMadridInput('2026-03-29T03:30')).toBe('2026-03-29T01:30:00.000Z')
  })

  it('resolves a time just after the autumn change', () => {
    expect(fromMadridInput('2026-10-25T04:00')).toBe('2026-10-25T03:00:00.000Z')
  })

  it('tolerates seconds in the input', () => {
    expect(fromMadridInput('2026-07-10T10:00:45')).toBe(
      '2026-07-10T08:00:00.000Z'
    )
  })

  it('maps empty and unparseable input to empty', () => {
    expect(fromMadridInput('')).toBe('')
    expect(fromMadridInput('not-a-date')).toBe('')
  })
})

describe(toMadridInput, () => {
  it('renders a stored instant on a Madrid clock', () => {
    expect(toMadridInput('2026-07-10T08:00:00.000Z')).toBe('2026-07-10T10:00')
    expect(toMadridInput('2026-01-15T09:00:00.000Z')).toBe('2026-01-15T10:00')
  })

  it('maps empty and unparseable input to empty', () => {
    expect(toMadridInput('')).toBe('')
    expect(toMadridInput('not-a-date')).toBe('')
  })
})

describe('round trip', () => {
  it.each([
    '2026-01-15T10:00',
    '2026-07-10T10:00',
    '2026-03-29T03:30',
    '2026-10-25T04:00',
    '2026-12-31T23:59'
  ])('survives a round trip for %s', (wallClock) => {
    expect(toMadridInput(fromMadridInput(wallClock))).toBe(wallClock)
  })
})

describe(madridTimeOf, () => {
  it('renders midnight as 00:00, not 24:00', () => {
    expect(madridTimeOf(new Date('2026-07-09T22:00:00.000Z'))).toBe('00:00')
  })
})

describe(madridDayNumber, () => {
  // 23:30 UTC on 9 July is already 01:30 on 10 July in Madrid, so the day the
  // notice calls "today" follows Madrid rather than the reader.
  it('counts the day on a Madrid calendar', () => {
    const lateUtc = new Date('2026-07-09T23:30:00.000Z')
    const nextMorning = new Date('2026-07-10T08:00:00.000Z')

    expect(madridDayNumber(lateUtc)).toBe(madridDayNumber(nextMorning))
  })
})

import { Button } from 'datocms-react-ui'
import s from '../searchReplace.module.css'
import type { Match } from '../replaceEngine'
import type { RowStatus, ScanRow } from '../useSearchReplace'
import { SKIP_REASON_LABELS } from '../urlTargets'

const BADGE_CLASS: Record<RowStatus, string> = {
  skipped: s.badge,
  'not-found': s.badge,
  'no-matches': s.badge,
  matched: `${s.badge} ${s.badgeMatched}`,
  applied: `${s.badge} ${s.badgeApplied}`,
  error: `${s.badge} ${s.badgeError}`
}

const badgeLabel = (row: ScanRow): string => {
  switch (row.status) {
    case 'skipped': {
      return 'Skipped'
    }
    case 'not-found': {
      return 'No record'
    }
    case 'no-matches': {
      return 'No matches'
    }
    case 'matched': {
      return `${row.matches.length} match${row.matches.length === 1 ? '' : 'es'}`
    }
    case 'applied': {
      return 'Applied'
    }
    default: {
      return 'Error'
    }
  }
}

const rowSubtitle = (row: ScanRow): string => {
  if (row.target.skipReason) {
    return SKIP_REASON_LABELS[row.target.skipReason]
  }

  const parts = [row.target.contentPath, row.target.datoLocale].filter(Boolean)

  // Resolved without a market_configuration record, by dropping the region
  // from the market's locale. Right for most markets, wrong for any that
  // shares another region's content (Argentina uses es-MX), and the locale
  // string cannot tell them apart — so say it was inferred.
  if (row.target.localeFromLanguage) {
    parts.push(
      `⚠ inferred from ${row.target.market?.locale ?? 'the market'} — no market_configuration entry`
    )
  }

  return row.message
    ? `${parts.join(' · ')} — ${row.message}`
    : parts.join(' · ')
}

type MatchLineProps = {
  match: Match
  selected: boolean
  disabled: boolean
  onToggle: (key: string) => void
  onEditRecord: (recordId: string) => void
}

const MatchLine = ({
  match,
  selected,
  disabled,
  onToggle,
  onEditRecord
}: MatchLineProps) => (
  <div
    className={`${s.match} ${selected && match.applicable ? '' : s.deselected}`}
  >
    <input
      type='checkbox'
      checked={selected && match.applicable}
      disabled={disabled || !match.applicable}
      aria-label={`Replace occurrence in ${match.path}`}
      onChange={() => onToggle(match.key)}
    />
    <div className={s.matchBody}>
      <div className={s.matchPath}>
        {match.path}
        {match.locale ? ` · ${match.locale}` : ''}
      </div>
      <div className={s.snippet}>
        {match.prefix}
        <span className={s.removed}>{match.matched}</span>
        {match.applicable && (
          <span className={s.added}>{match.replacement}</span>
        )}
        {match.suffix}
      </div>
      {match.note && <div className={s.matchNote}>{match.note}</div>}
    </div>
    {/* A match usually sits in a record the page merely points at, so the
        page's own Open button does not lead to it. */}
    <Button buttonSize='xxs' onClick={() => onEditRecord(match.recordId)}>
      Open
    </Button>
  </div>
)

export type ResultRowProps = {
  row: ScanRow
  selectedKeys: Set<string>
  busy: boolean
  onToggleKey: (key: string) => void
  onToggleRow: (row: ScanRow, selected: boolean) => void
  onApplyRow: (row: ScanRow) => void
  onEditRecord: (recordId: string) => void
}

export const ResultRow = ({
  row,
  selectedKeys,
  busy,
  onToggleKey,
  onToggleRow,
  onApplyRow,
  onEditRecord
}: ResultRowProps) => {
  const applicableMatches = row.matches.filter((match) => match.applicable)
  const selectedInRow = applicableMatches.filter((match) =>
    selectedKeys.has(match.key)
  )
  const allSelected =
    applicableMatches.length > 0 &&
    selectedInRow.length === applicableMatches.length
  const hasMatches = row.status === 'matched' && row.matches.length > 0

  return (
    <div className={s.row}>
      <div className={`${s.rowHeader} ${hasMatches ? '' : s.rowHeaderQuiet}`}>
        {hasMatches && (
          <input
            type='checkbox'
            checked={allSelected}
            aria-label={`Select every match in ${row.target.raw}`}
            onChange={() => onToggleRow(row, !allSelected)}
          />
        )}
        <div className={s.rowUrl}>
          {row.target.raw}
          <span className={s.rowMeta}>{rowSubtitle(row)}</span>
        </div>
        <span className={BADGE_CLASS[row.status]}>{badgeLabel(row)}</span>
        {row.recordId && (
          <Button
            buttonSize='xxs'
            onClick={() => onEditRecord(row.recordId as string)}
          >
            Open
          </Button>
        )}
        {hasMatches && (
          <Button
            buttonSize='xxs'
            buttonType='primary'
            disabled={busy || selectedInRow.length === 0}
            onClick={() => onApplyRow(row)}
          >
            Apply {selectedInRow.length}
          </Button>
        )}
      </div>

      {hasMatches &&
        row.matches.map((match) => (
          <MatchLine
            key={match.key}
            match={match}
            selected={selectedKeys.has(match.key)}
            disabled={busy}
            onToggle={onToggleKey}
            onEditRecord={onEditRecord}
          />
        ))}
    </div>
  )
}

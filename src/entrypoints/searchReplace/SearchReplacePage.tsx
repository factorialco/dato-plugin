import type { RenderPageCtx } from 'datocms-plugin-sdk'
import {
  Button,
  Canvas,
  Spinner,
  SwitchField,
  Toolbar,
  ToolbarStack,
  ToolbarTitle
} from 'datocms-react-ui'
import s from './searchReplace.module.css'
import { ScanForm } from './components/ScanForm'
import { ResultRow } from './components/ResultRow'
import { useSearchReplace } from './useSearchReplace'

export type SearchReplacePageProps = {
  ctx: RenderPageCtx
}

export const SearchReplacePage = ({ ctx }: SearchReplacePageProps) => {
  const state = useSearchReplace(ctx)
  const busy = state.phase === 'scanning' || state.phase === 'applying'
  const matchedRows = state.rows.filter((row) => row.status === 'matched')
  const appliedRows = state.rows.filter((row) => row.status === 'applied')

  const confirmAndApply = async (
    rows: typeof state.pendingRows,
    question: string
  ) => {
    const confirmed = await ctx.openConfirm({
      title: 'Apply replacements?',
      content: question,
      choices: [{ label: 'Apply', value: true, intent: 'positive' }],
      cancel: { label: 'Cancel', value: false }
    })

    if (confirmed) {
      await state.applyRows(rows)
    }
  }

  return (
    <Canvas ctx={ctx} noAutoResizer>
      <div className={s.container}>
        <Toolbar className={s.toolbar}>
          <ToolbarTitle>Search &amp; Replace</ToolbarTitle>
          <div className={s.info}>
            Replace inline text across specific pages, with a dry run first
          </div>
        </Toolbar>

        {state.setupError && <div className={s.error}>{state.setupError}</div>}

        {state.loadingSchema ? (
          <div className={s.spinnerContainer}>
            <Spinner placement='inline' /> Loading models…
          </div>
        ) : (
          state.schema && (
            <ScanForm
              models={state.schema.models}
              model={state.model}
              onModelChange={state.handleModelChange}
              find={state.find}
              onFindChange={state.handleFindChange}
              replace={state.replace}
              onReplaceChange={state.handleReplaceChange}
              urls={state.urls}
              onUrlsChange={state.handleUrlsChange}
              caseSensitive={state.caseSensitive}
              onCaseSensitiveChange={state.handleCaseSensitiveChange}
              wholeWord={state.wholeWord}
              onWholeWordChange={state.handleWholeWordChange}
              targets={state.targets}
              canScan={state.canScan}
              busy={busy}
              onScan={state.handleScan}
            />
          )
        )}

        {/*
          Shown for the whole of a busy phase, not only once the per-page
          counter exists: building the path index runs before the first page
          is scanned, and previously left the screen looking idle.
        */}
        {busy && (
          <div className={s.spinnerContainer}>
            <Spinner placement='inline' />
            {state.progress ? (
              <>
                {state.phase === 'scanning' ? 'Scanning' : 'Applying'}{' '}
                {state.progress.done}
                {' / '}
                {state.progress.total}
              </>
            ) : (
              (state.stage ?? 'Working…')
            )}
          </div>
        )}

        {state.rows.length > 0 && (
          <>
            {/*
              Applying re-walks each record with the current options, so
              results from different parameters must not be written. Say why
              the button is disabled rather than just disabling it.
            */}
            {state.resultsStale && (
              <div className={s.spinnerContainer}>
                Parameters changed since this dry run — run it again to apply.
              </div>
            )}

            <ToolbarStack className={s.toolbar}>
              <div className={s.summary}>
                <span>
                  <strong>{matchedRows.length}</strong> page(s) with matches
                </span>
                <span>
                  <strong>{state.selectedCount}</strong> occurrence(s) selected
                </span>
                {appliedRows.length > 0 && (
                  <span>
                    <strong>{appliedRows.length}</strong> page(s) applied
                  </span>
                )}
              </div>
              <div className={s.actions}>
                <SwitchField
                  name='publish'
                  id='publish'
                  label='Republish already-published pages'
                  hint='Pages with unpublished draft changes are always left as drafts.'
                  value={state.publishIfPublished}
                  onChange={state.handlePublishChange}
                />
                <Button
                  buttonType='primary'
                  disabled={
                    busy || state.resultsStale || state.pendingRows.length === 0
                  }
                  onClick={() =>
                    confirmAndApply(
                      state.pendingRows,
                      `Replace ${state.selectedCount} occurrence(s) across ${state.pendingRows.length} page(s)?`
                    )
                  }
                >
                  Apply all ({state.pendingRows.length})
                </Button>
                <Button disabled={busy} onClick={state.handleReset}>
                  Clear
                </Button>
              </div>
            </ToolbarStack>

            {state.rows.map((row, index) => (
              <ResultRow
                key={`${index}-${row.target.raw}`}
                row={row}
                selectedKeys={state.selectedKeys}
                // Stale results must not be applied per-row either.
                busy={busy || state.resultsStale}
                onToggleKey={state.handleToggleKey}
                onToggleRow={state.handleToggleRow}
                onApplyRow={(target) =>
                  confirmAndApply(
                    [target],
                    `Replace the selected occurrence(s) in ${target.target.raw}?`
                  )
                }
                onEditRecord={(recordId) => ctx.editItem(recordId)}
              />
            ))}
          </>
        )}

        {state.phase === 'reviewing' && state.rows.length === 0 && (
          <div className={s.empty}>No pages to report.</div>
        )}
      </div>
    </Canvas>
  )
}

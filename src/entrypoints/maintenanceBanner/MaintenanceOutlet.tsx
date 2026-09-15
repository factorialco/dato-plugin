import type { RenderItemFormOutletCtx } from 'datocms-plugin-sdk'
import { Button, Canvas } from 'datocms-react-ui'
import {
  activeMaintenanceWindow,
  openMaintenanceNotice
} from './maintenanceBanner'
import { formatMaintenanceStart } from './maintenanceBanner.utils'

/**
 * A standing reminder at the top of the record form, for as long as a
 * maintenance window is configured.
 *
 * The modal is shown once and then dismissed for good, which leaves nothing to
 * check against later — "was it today at 14:00 or tomorrow?". This sits where
 * that question gets asked: directly above the fields someone is about to
 * edit, on the screen the notice is asking them not to use. It restates the
 * start time and reopens the full notice on demand.
 *
 * Unlike the modal it never self-dismisses, so it does not use — or write —
 * the dismissal key.
 */
export const MaintenanceOutlet = ({
  ctx
}: {
  ctx: RenderItemFormOutletCtx
}) => {
  const maintenanceWindow = activeMaintenanceWindow(ctx)

  if (!maintenanceWindow) {
    return null
  }

  return (
    <Canvas ctx={ctx}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-m)',
          padding: 'var(--spacing-m) var(--spacing-l)',
          border: '1px solid var(--alert-color)',
          borderRadius: 'var(--border-radius-s, 3px)',
          background: 'var(--light-bg-color)'
        }}
      >
        <span aria-hidden='true'>⚠️</span>
        <span style={{ flex: 1 }}>
          <strong>Scheduled maintenance</strong>{' '}
          {formatMaintenanceStart(maintenanceWindow.startsAt)} — avoid editing
          around that time, and save any change before it starts.
        </span>
        <Button
          buttonSize='xxs'
          onClick={() => openMaintenanceNotice(ctx, maintenanceWindow)}
        >
          Read the notice
        </Button>
      </div>
    </Canvas>
  )
}

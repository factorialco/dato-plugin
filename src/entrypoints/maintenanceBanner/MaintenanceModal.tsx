import type { RenderModalCtx } from 'datocms-plugin-sdk'
import { Button, Canvas } from 'datocms-react-ui'
import { toParagraphs } from './maintenanceBanner.utils'

export const MAINTENANCE_MODAL_ID = 'maintenanceNotice'

/**
 * The notice itself.
 *
 * Rendered by the plugin rather than through `ctx.openConfirm`, whose `content`
 * is a single string: a multi-paragraph message would collapse into one block
 * of text there. Here the paragraphs and line breaks survive.
 */
export const MaintenanceModal = ({ ctx }: { ctx: RenderModalCtx }) => {
  const text = String(ctx.parameters.text ?? '')

  return (
    <Canvas ctx={ctx}>
      <div style={{ padding: 'var(--spacing-l)' }}>
        {toParagraphs(text).map((lines) => (
          <p
            key={lines.join('\n')}
            style={{ margin: '0 0 var(--spacing-m)', lineHeight: 1.5 }}
          >
            {lines.map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            buttonType='primary'
            onClick={() => {
              ctx.resolve('ack')
            }}
          >
            Got it
          </Button>
        </div>
      </div>
    </Canvas>
  )
}

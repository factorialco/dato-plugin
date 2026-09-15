import type { RenderPageCtx } from 'datocms-plugin-sdk'
import { Canvas } from 'datocms-react-ui'
import s from '../searchReplace.module.css'

export const AccessDenied = ({ ctx }: { ctx: RenderPageCtx }) => (
  <Canvas ctx={ctx}>
    <div className={s.empty}>
      Your role does not have access to Search &amp; Replace. A project admin
      can grant it in the plugin&rsquo;s settings.
    </div>
  </Canvas>
)

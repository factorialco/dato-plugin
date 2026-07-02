import { RenderPageCtx } from "datocms-plugin-sdk";
import { Canvas, Toolbar, ToolbarTitle } from "datocms-react-ui";
import s from "../styles.module.css";
import {
  buildBannerText,
  getMaintenanceWindow,
  MaintenanceParameters,
} from "./maintenanceBanner.utils";

export type MaintenancePageProps = {
  ctx: RenderPageCtx;
};

export const MaintenancePage = ({ ctx }: MaintenancePageProps) => {
  const parameters = ctx.plugin.attributes.parameters as MaintenanceParameters;
  const maintenanceWindow = getMaintenanceWindow(parameters);

  return (
    <Canvas ctx={ctx}>
      <div className={s.container}>
        <Toolbar className={s.toolbar}>
          <div>
            <ToolbarTitle>Maintenance</ToolbarTitle>
          </div>
          <div className={s.info}>Scheduled maintenance banner for this project</div>
        </Toolbar>

        <div className={s.results}>
          {!ctx.isEnvironmentPrimary && (
            <div className={s.info}>
              Preview only — the maintenance toast is suppressed outside the primary
              environment.
            </div>
          )}

          {!maintenanceWindow ? (
            <div className={s.noResults}>No maintenance banner currently enabled.</div>
          ) : (
            <div className={s.resultsList}>
              <div className={s.result}>
                <div>{buildBannerText(maintenanceWindow)}</div>
                <div className={s.resultMessage}>
                  Visible to everyone until it&apos;s disabled from the config screen.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Canvas>
  );
};

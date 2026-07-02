import { RenderConfigScreenCtx } from "datocms-plugin-sdk";
import { Button, Canvas, SwitchField, TextareaField, TextField } from "datocms-react-ui";
import { useState } from "react";
import s from "../styles.module.css";

type Props = {
  ctx: RenderConfigScreenCtx;
};

type Parameters = {
  authorization: string;
  maintenanceEnabled?: boolean;
  maintenanceMessage?: string;
  maintenanceStartsAt?: string;
};

const isValidMaintenanceWindow = (message: string, startsAt: string): boolean => {
  if (!message || !startsAt) {
    return false;
  }

  return !Number.isNaN(new Date(startsAt).getTime());
};

// Native <input type="date"> / <input type="time"> always report values in
// "YYYY-MM-DD" / "HH:mm" regardless of locale, so this round-trips cleanly
// with the "YYYY-MM-DDTHH:mm:00.000Z" (UTC) strings stored in plugin params.
const splitIsoDateTime = (iso?: string): { date: string; time: string } => {
  if (!iso) {
    return { date: "", time: "" };
  }

  const [date, time] = iso.replace(/Z$/, "").split("T");
  return { date: date ?? "", time: (time ?? "").slice(0, 5) };
};

const combineToIso = (date: string, time: string): string => {
  if (!date || !time) {
    return "";
  }

  return `${date}T${time}:00.000Z`;
};

export default function ConfigScreen({ ctx }: Props) {
  const parameters = ctx.plugin.attributes.parameters as Parameters;
  const [currentAuth, setCurrentAuth] = useState(parameters.authorization);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(
    parameters.maintenanceEnabled ?? false
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    parameters.maintenanceMessage ?? ""
  );

  const initialStart = splitIsoDateTime(parameters.maintenanceStartsAt);
  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);

  const maintenanceStartsAt = combineToIso(startDate, startTime);

  const hasChanges =
    parameters.authorization !== currentAuth ||
    (parameters.maintenanceEnabled ?? false) !== maintenanceEnabled ||
    (parameters.maintenanceMessage ?? "") !== maintenanceMessage ||
    (parameters.maintenanceStartsAt ?? "") !== maintenanceStartsAt;

  const handleSave = () => {
    if (maintenanceEnabled && !isValidMaintenanceWindow(maintenanceMessage, maintenanceStartsAt)) {
      ctx.alert(
        "To enable the maintenance banner, fill in the message and a valid start date/time."
      );
      return;
    }

    ctx.updatePluginParameters({
      ...parameters,
      authorization: currentAuth,
      maintenanceEnabled,
      maintenanceMessage,
      maintenanceStartsAt,
    });
    ctx.notice("Settings updated successfully!");
  };

  return (
    <Canvas ctx={ctx}>
      <div className={s.inspector}>
        <TextField
          hint="This will be used to authorize the webpage requests that we use to validate marketing_form_campaign values."
          label="Webpage Authorization"
          id="auth"
          name="auth"
          required
          onChange={(newValue) => setCurrentAuth(newValue)}
          value={currentAuth}
        />

        <SwitchField
          id="maintenanceEnabled"
          name="maintenanceEnabled"
          label="Enable maintenance banner"
          hint="While enabled, editors in the main environment will see a persistent notice — turn it off manually once maintenance is over."
          value={maintenanceEnabled}
          onChange={setMaintenanceEnabled}
        />

        <TextareaField
          id="maintenanceMessage"
          name="maintenanceMessage"
          label="Maintenance message"
          hint="The scheduled start time below is inserted automatically — appended at the end, or in place of {startsAt} if you include it in the text."
          value={maintenanceMessage}
          onChange={setMaintenanceMessage}
        />

        <div className={s.row}>
          <div className={s.col}>
            <TextField
              id="maintenanceStartDate"
              name="maintenanceStartDate"
              label="Starts at — date (UTC)"
              value={startDate}
              onChange={setStartDate}
              textInputProps={{ type: "date" }}
            />
          </div>
          <div className={s.col}>
            <TextField
              id="maintenanceStartTime"
              name="maintenanceStartTime"
              label="Starts at — time (UTC)"
              value={startTime}
              onChange={setStartTime}
              textInputProps={{ type: "time" }}
            />
          </div>
        </div>

        <Button disabled={!hasChanges} onClick={handleSave}>
          Save config
        </Button>
      </div>
    </Canvas>
  );
}

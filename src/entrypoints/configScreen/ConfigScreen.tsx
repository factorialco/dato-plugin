import { RenderConfigScreenCtx } from "datocms-plugin-sdk";
import { Button, Canvas, TextField } from "datocms-react-ui";
import { useState } from "react";
import s from "../styles.module.css";

type Props = {
  ctx: RenderConfigScreenCtx;
};

type Parameters = {
  authorization: string;
};

export default function ConfigScreen({ ctx }: Props) {
  const parameters = ctx.plugin.attributes.parameters as Parameters;
  const [currentAuth, setCurrentAuth] = useState(parameters.authorization);

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

        <Button
          disabled={parameters.authorization === currentAuth}
          onClick={() => {
            ctx.updatePluginParameters({ authorization: currentAuth });
            ctx.notice("Settings updated successfully!");
          }}
        >
          Save config
        </Button>
      </div>
    </Canvas>
  );
}

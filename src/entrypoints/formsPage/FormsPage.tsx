import { RenderPageCtx } from "datocms-plugin-sdk";
import { useMemo, useState } from "react";
import { buildClient } from "@datocms/cma-client-browser";
import {
  Canvas,
  ToolbarTitle,
  Toolbar,
  ToolbarStack,
  SelectField,
  Spinner,
} from "datocms-react-ui";
import s from "../styles.module.css";
import { CustomFunction, ResultItem, ToolOption } from "./forms.types";

import { Tool } from "./tools/Tool";
import { getAllForms } from "./forms.services";
import { mapMarketingFormCampaign } from "./forms.utils";

const TOOL_OPTIONS: ToolOption[] = [
  { label: "Campaign Search", value: "search" },
  { label: "Issue Scanner", value: "scanner" },
];

export type FormsPageProps = {
  ctx: RenderPageCtx;
};

export const FormsPage = ({ ctx }: FormsPageProps) => {
  const [selectedTool, setSelectedTool] = useState(TOOL_OPTIONS[0]);
  const [resultForms, setResultForms] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const client = useMemo(() => {
    if (ctx.currentUserAccessToken) {
      return buildClient({
        apiToken: ctx.currentUserAccessToken,
        environment: ctx.environment,
      });
    }
  }, [ctx.currentUserAccessToken, ctx.environment]);

  const onSubmit = async (customFunction: CustomFunction) => {
    try {
      if (client) {
        setIsLoading(true);

        const forms = await getAllForms(client as any);
        const classifiedCampaigns = mapMarketingFormCampaign(
          Object.values(forms)
        );
        const results = await customFunction(classifiedCampaigns, forms);

        setIsLoading(false);
        setResultForms(results);
      }
    } catch (e) {
      setIsLoading(false);
    }
  };

  return (
    <Canvas ctx={ctx} noAutoResizer>
      <div className={s.container}>
        <Toolbar className={s.toolbar}>
          <div>
            <ToolbarTitle>Forms</ToolbarTitle>
          </div>
          <div className={s.info}>
            Simple tools to manage forms and identify issues
          </div>
        </Toolbar>
        <ToolbarStack className={s.toolbarStack}>
          <div className={s.row}>
            <div className={s.col}>
              <SelectField
                name="Tool"
                id="tool"
                label="Selected Tool"
                value={selectedTool}
                onChange={(newValue) => {
                  setSelectedTool(newValue as ToolOption);
                }}
                selectInputProps={{
                  options: TOOL_OPTIONS,
                }}
              />
            </div>
            <div className={s.col}>
              <Tool
                toolType={selectedTool.value}
                commonToolProps={{ isLoading, onSubmit, ctx }}
              />
            </div>
          </div>
        </ToolbarStack>

        <div className={s.results}>
          <div className={s.row}>
            <h3>Results</h3>
            <div className={s.info}>Click on the results to edit them!</div>
          </div>
          <div className={s.resultsList}>
            {isLoading ? (
              <div className={s.spinnerContainer}>
                <Spinner placement="inline" />
              </div>
            ) : resultForms.length ? (
              resultForms.map(({ id, text, name }) => {
                return (
                  <div
                    className={s.result}
                    key={id}
                    onClick={() => {
                      ctx.editItem(id);
                    }}
                  >
                    <div>{name}</div>
                    <div className={s.resultMessage}>{text}</div>
                  </div>
                );
              })
            ) : (
              <div className={s.noResults}>No Results</div>
            )}
          </div>
        </div>
      </div>
    </Canvas>
  );
};

import { RenderPagePropertiesAndMethods } from "datocms-plugin-sdk";

export type ClassifiedFormBlocks = Record<
  string,
  {
    marketing_form_campaign: string;
  }[]
>;
export type ResultItem = { id: string; name: string; text?: string };
export type DatoItem = { id: string; section_id: string };
export type ToolType = "search" | "scanner";
export type ToolOption = { label: string; value: ToolType };

export type CustomFunction = (
  client: ClassifiedFormBlocks,
  forms: Record<string, DatoItem>
) => Promise<ResultItem[]>;

export type CommonToolProps = {
  ctx: RenderPagePropertiesAndMethods;
  isLoading: boolean;
  onSubmit: (customFunction: CustomFunction) => void;
};

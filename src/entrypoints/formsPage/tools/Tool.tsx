import { CommonToolProps, ToolType } from "../forms.types";
import { ScannerTool } from "./ScannerTool";
import { SearchTool } from "./SearchTool";

type ToolProps = {
  toolType: ToolType;
  commonToolProps: CommonToolProps;
};

export const Tool = ({ toolType, commonToolProps }: ToolProps) => {
  switch (toolType) {
    case "search":
      return <SearchTool {...commonToolProps} />;
    case "scanner":
      return <ScannerTool {...commonToolProps} />;
  }
};

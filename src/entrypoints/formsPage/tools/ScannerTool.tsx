import { Button } from "datocms-react-ui";
import { CommonToolProps } from "../forms.types";
import { validateFormBatch } from "./scannerTool.services";
import s from "../../styles.module.css";

export const ScannerTool = ({ isLoading, onSubmit, ctx }: CommonToolProps) => {
  const scanForms = () =>
    onSubmit(async (campaigns, forms) => {
      const invalidForms = await validateFormBatch(
        campaigns,
        ctx.plugin.attributes.parameters.authorization as string
      );

      return invalidForms.map((invalidForm) => ({
        ...invalidForm,
        name: forms[invalidForm.id].section_id,
      }));
    });

  return (
    <div className={s.toolsRow}>
      <Button className={s.button} onClick={scanForms} disabled={isLoading}>
        Scan Forms for potential issues
      </Button>
    </div>
  );
};

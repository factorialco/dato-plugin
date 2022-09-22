import axios from "axios";
import { Button } from "datocms-react-ui";
import { CommonToolProps } from "../forms.types";
import s from "../../styles.module.css";

const validateFormsRemote = async (
  forms: Record<string, any[]>,
  authorization: string
) => {
  return axios
    .post<
      unknown,
      { data: { invalidForms: { id: string; reason?: string }[] } }
    >(
      process.env.REACT_APP_VALIDATE_BATCH_ENDPOINT as string,
      {
        forms,
      },
      {
        headers: {
          Authorization: authorization,
        },
      }
    )
    .then((response) =>
      response.data.invalidForms.map(({ id, reason }) => ({ id, text: reason }))
    );
};

export const ScannerTool = ({ isLoading, onSubmit, ctx }: CommonToolProps) => {
  const scanForms = () =>
    onSubmit(async (campaigns, forms) => {
      const invalidForms = await validateFormsRemote(
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

import axios from "axios";

export const validateFormBatch = async (
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

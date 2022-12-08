import axios from "axios";

export const remoteValidation = async (
  campaign: string,
  authorization: string
) => {
  const result = await axios.post<
    { campaign: string },
    { data: { valid: boolean } }
  >(
    `${process.env.REACT_APP_BASE_PATH}/api/dato/form_campaign/validate`,
    { campaign },
    {
      headers: {
        Authorization: authorization,
      },
    }
  );
  return result.data.valid;
};

import axios from "axios";

export const remoteValidation = async (
  campaign: string,
  authorization: string
) => {
  const result = await axios.post<
    { campaign: string },
    { data: { valid: boolean } }
  >(
    process.env.REACT_APP_VALIDATE_ENDPOINT as string,
    { campaign },
    {
      headers: {
        Authorization: authorization,
      },
    }
  );
  return result.data.valid;
};

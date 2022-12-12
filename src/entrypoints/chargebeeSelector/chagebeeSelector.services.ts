import axios from "axios";
import { Plan } from "./types";

export type ChargebeeElements = "bundle" | "plan" | "usage" | "addon" | "core";

export const getElements = async (
  chargebeeElement: ChargebeeElements,
  authorization: string
) => {
  const result = await axios.get<{}, { data: { plans: Plan[] } }>(
    `${process.env.REACT_APP_BASE_PATH}/api/dato/pricing/${chargebeeElement}`,
    {
      headers: {
        Authorization: authorization,
      },
    }
  );
  return result.data.plans;
};

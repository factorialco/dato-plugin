import axios from "axios";

const ENDPOINTS = {
  bundle: "bundle_addons",
  plan: "plan_addons",
  usage: "usage_addons",
  addon: "addon_addons",
  core: "core_plans",
};

export type ChargebeeElements = keyof typeof ENDPOINTS;

export const getElements = async <T>(
  chargebeeElement: ChargebeeElements,
  authorization: string
) => {
  const result = await axios.get<{}, { data: { elements: T[] } }>(
    `${process.env.REACT_APP_BASE_PATH}/api/dato/pricing/${ENDPOINTS[chargebeeElement]}`,
    {
      headers: {
        Authorization: authorization,
      },
    }
  );
  return result.data.elements;
};

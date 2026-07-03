export type MaintenanceParameters = {
  maintenanceEnabled?: boolean;
  maintenanceMessage?: string;
  maintenanceStartsAt?: string;
};

export type MaintenanceWindow = {
  message: string;
  startsAt: string;
};

export const getMaintenanceWindow = (
  parameters: MaintenanceParameters
): MaintenanceWindow | null => {
  if (!parameters.maintenanceEnabled) {
    return null;
  }

  const { maintenanceMessage, maintenanceStartsAt } = parameters;

  if (!maintenanceMessage || !maintenanceStartsAt) {
    return null;
  }

  if (Number.isNaN(new Date(maintenanceStartsAt).getTime())) {
    return null;
  }

  return {
    message: maintenanceMessage,
    startsAt: maintenanceStartsAt,
  };
};

// Placeholder admins can drop anywhere in the message to control where the
// start time appears (e.g. "...scheduled maintenance {startsAt} on..."). If
// it's not used, the start time is appended at the end instead.
export const START_PLACEHOLDER = "{startsAt}";

// Renders the start time in the reader's own locale/timezone, converted
// automatically from the UTC value stored in the plugin parameters.
export const buildBannerText = (maintenanceWindow: MaintenanceWindow): string => {
  const formattedStartsAt = new Date(maintenanceWindow.startsAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const startsAtClause = `(starts at ${formattedStartsAt})`;

  return maintenanceWindow.message.includes(START_PLACEHOLDER)
    ? maintenanceWindow.message.replace(START_PLACEHOLDER, startsAtClause)
    : `${maintenanceWindow.message} ${startsAtClause}`;
};

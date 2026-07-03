import { buildBannerText, getMaintenanceWindow } from "./maintenanceBanner.utils";

describe("getMaintenanceWindow", () => {
  it("returns null when maintenance is not enabled", () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: false,
        maintenanceMessage: "Maintenance!",
        maintenanceStartsAt: "2026-07-10T08:00:00.000Z",
      })
    ).toBeNull();
  });

  it("returns null when the message is missing", () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: "",
        maintenanceStartsAt: "2026-07-10T08:00:00.000Z",
      })
    ).toBeNull();
  });

  it("returns null when the start date/time is missing", () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: "Maintenance!",
        maintenanceStartsAt: "",
      })
    ).toBeNull();
  });

  it("returns null when the start date/time is malformed", () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: "Maintenance!",
        maintenanceStartsAt: "not-a-date",
      })
    ).toBeNull();
  });

  it("returns the window when enabled and valid", () => {
    expect(
      getMaintenanceWindow({
        maintenanceEnabled: true,
        maintenanceMessage: "Maintenance!",
        maintenanceStartsAt: "2026-07-10T08:00:00.000Z",
      })
    ).toEqual({
      message: "Maintenance!",
      startsAt: "2026-07-10T08:00:00.000Z",
    });
  });
});

describe("buildBannerText", () => {
  // Assertions use toContain rather than an exact string: toLocaleString's
  // output depends on the machine's locale/timezone, which varies between
  // dev machines and CI.
  it("appends the formatted start time to the message when there's no placeholder", () => {
    const text = buildBannerText({
      message: "Maintenance!",
      startsAt: "2026-07-10T08:00:00.000Z",
    });

    expect(text).toMatch(/^Maintenance! \(starts at .+\)$/);
  });

  it("inserts the start time in place of the {startsAt} placeholder", () => {
    const text = buildBannerText({
      message: "Scheduled maintenance {startsAt} on the admin.",
      startsAt: "2026-07-10T08:00:00.000Z",
    });

    expect(text).toMatch(/^Scheduled maintenance \(starts at .+\) on the admin\.$/);
    expect(text).not.toContain("{startsAt}");
  });
});

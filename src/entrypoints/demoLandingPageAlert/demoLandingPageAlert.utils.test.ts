import { describe, expect, it } from "vitest";
import { checkDemoLandingPageLimits } from "./demoLandingPageAlert.utils";

const instance = (variant: string) => ({ attributes: { variant } });

describe("checkDemoLandingPageLimits", () => {
  it("allows the first control and the first variant", () => {
    expect(
      checkDemoLandingPageLimits([{ variant: "control" }], instance("variant"))
    ).toEqual({ canCreate: true });
  });

  it("blocks a second control page", () => {
    const result = checkDemoLandingPageLimits(
      [{ variant: "control" }],
      instance("control")
    );

    expect(result.canCreate).toBe(false);
    expect(result.message).toContain("Control pages: 2 (max 1).");
  });

  it("blocks a second variant page", () => {
    const result = checkDemoLandingPageLimits(
      [{ variant: "variant" }],
      instance("variant")
    );

    expect(result.canCreate).toBe(false);
    expect(result.message).toContain("Variant pages: 2 (max 1).");
  });

  it("allows publishing when nothing exists yet", () => {
    expect(checkDemoLandingPageLimits([])).toEqual({ canCreate: true });
  });
});

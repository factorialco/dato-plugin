import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMETERS,
  normalizeParameters,
  readParameters,
} from "./pluginParameters";

describe("normalizeParameters", () => {
  it("falls back to the previously hardcoded values when unconfigured", () => {
    expect(normalizeParameters({})).toEqual(DEFAULT_PARAMETERS);
    expect(normalizeParameters(null)).toEqual(DEFAULT_PARAMETERS);
    expect(normalizeParameters(undefined)).toEqual(DEFAULT_PARAMETERS);
  });

  it("keeps saved values and fills the gaps of a partial shape", () => {
    expect(
      normalizeParameters({ formTemplateModelId: "custom-model" })
    ).toEqual({
      ...DEFAULT_PARAMETERS,
      formTemplateModelId: "custom-model",
    });
  });

  it("ignores values of the wrong type or that are blank", () => {
    expect(
      normalizeParameters({
        demoLandingPageModelId: 42,
        formFieldsBlockApiKey: "   ",
      })
    ).toEqual(DEFAULT_PARAMETERS);
  });

  it("trims whitespace and strips trailing slashes from the preview URL", () => {
    expect(
      normalizeParameters({ previewBaseUrl: "  https://example.com//  " })
        .previewBaseUrl
    ).toBe("https://example.com");
  });

  it("defaults the preview URL to empty, which hides the preview", () => {
    expect(normalizeParameters({}).previewBaseUrl).toBe("");
  });
});

describe("readParameters", () => {
  it("reads the parameters off a hook ctx", () => {
    const ctx = {
      plugin: { attributes: { parameters: { previewBaseUrl: "https://a.dev" } } },
    };

    expect(readParameters(ctx).previewBaseUrl).toBe("https://a.dev");
  });
});

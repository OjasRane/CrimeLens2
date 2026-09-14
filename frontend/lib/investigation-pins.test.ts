import { describe, expect, it } from "vitest";
import {
  formatCoordinate,
  PIN_CATEGORIES,
  PIN_CATEGORY_DETAILS,
  toLocalDateTimeInput,
} from "./investigation-pins";

describe("investigation pin presentation helpers", () => {
  it("formats latitude and longitude with the correct hemispheres", () => {
    expect(formatCoordinate(18.922, "latitude")).toBe("18.92200° N");
    expect(formatCoordinate(-33.8688, "latitude")).toBe("33.86880° S");
    expect(formatCoordinate(72.8347, "longitude")).toBe("72.83470° E");
    expect(formatCoordinate(-87.6298, "longitude")).toBe("87.62980° W");
  });

  it("provides a non-color category code for every marker category", () => {
    for (const category of PIN_CATEGORIES) {
      expect(PIN_CATEGORY_DETAILS[category].label).not.toBe("");
      expect(PIN_CATEGORY_DETAILS[category].shortLabel).toHaveLength(2);
      expect(PIN_CATEGORY_DETAILS[category].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("does not expose an invalid timestamp to the editor", () => {
    expect(toLocalDateTimeInput("not-a-date")).toBe("");
    expect(toLocalDateTimeInput(null)).toBe("");
  });
});

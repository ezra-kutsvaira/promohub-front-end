import { describe, expect, test } from "bun:test";

import { normalizeDiscountTypeForApi } from "./discountType";

describe("normalizeDiscountTypeForApi", () => {
  test("accepts noisy FIXED_AMOUNT input and resolves to FLAT", () => {
    expect(normalizeDiscountTypeForApi("FIXED_AMOUNT ,")).toBe("FLAT");
  });

  test("keeps fixed alias compatibility", () => {
    expect(normalizeDiscountTypeForApi("fixed")).toBe("FLAT");
  });

  test("keeps percentage aliases normalized", () => {
    expect(normalizeDiscountTypeForApi("percent")).toBe("PERCENTAGE");
  });
});

import { describe, expect, test } from "bun:test";

import { normalizeDiscountTypeForApi } from "./discountType";

describe("normalizeDiscountTypeForApi", () => {
  test("accepts noisy FIXED_AMOUNT input and resolves to FIXED", () => {
    expect(normalizeDiscountTypeForApi("FIXED_AMOUNT ,")).toBe("FIXED");
  });

  test("keeps FIXED alias compatibility", () => {
    expect(normalizeDiscountTypeForApi("fixed")).toBe("FIXED");
  });

  test("keeps percentage aliases normalized", () => {
    expect(normalizeDiscountTypeForApi("percent")).toBe("PERCENTAGE");
  });
});

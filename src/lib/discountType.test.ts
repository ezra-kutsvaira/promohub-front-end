import { describe, expect, test } from "bun:test";

import { normalizeDiscountTypeForApi } from "./discountType";

describe("normalizeDiscountTypeForApi", () => {
  test("accepts noisy FIXED_AMOUNT input and resolves to FIXED_AMOUNT", () => {
    expect(normalizeDiscountTypeForApi("FIXED_AMOUNT ,")).toBe("FIXED_AMOUNT");
  });

  test("keeps FIXED alias compatibility", () => {
    expect(normalizeDiscountTypeForApi("fixed")).toBe("FIXED_AMOUNT");
  });
});

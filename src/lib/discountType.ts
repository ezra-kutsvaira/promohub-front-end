export const normalizeDiscountTypeForApi = (value?: string): string => {
  if (!value) {
    return "";
  }

  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  if (normalized === "FIXED") {
    return "FIXED_AMOUNT";
  }

  return normalized;
};

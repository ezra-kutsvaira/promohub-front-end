import type { Promotion } from "@/lib/api";

const toNormalizedStatus = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/[-\s]+/g, "_").toUpperCase() : "";

const statusAliases: Record<string, string[]> = {
  PENDING: ["PENDING", "SUBMITTED", "IN_REVIEW"],
  APPROVED: ["APPROVED", "ACTIVE", "VERIFIED", "PUBLISHED"],
  REJECTED: ["REJECTED", "DECLINED"],
};

const matchesStatus = (status: string, expected: keyof typeof statusAliases): boolean =>
  statusAliases[expected].includes(status);

export const getPromotionVerificationStatus = (promotion: Promotion): string => {
  const verificationStatus = toNormalizedStatus(promotion.verificationStatus);
  if (verificationStatus) return verificationStatus;
  return toNormalizedStatus(promotion.status);
};

export const isPendingPromotion = (promotion: Promotion): boolean => {
  const status = getPromotionVerificationStatus(promotion);
  return matchesStatus(status, "PENDING");
};

export const isApprovedPromotion = (promotion: Promotion): boolean => {
  const status = getPromotionVerificationStatus(promotion);
  return matchesStatus(status, "APPROVED");
};

export const isRejectedPromotion = (promotion: Promotion): boolean =>
  matchesStatus(getPromotionVerificationStatus(promotion), "REJECTED");

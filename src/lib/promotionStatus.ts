import type { Promotion } from "@/lib/api";

const toNormalizedStatus = (value: unknown): string =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const getPromotionVerificationStatus = (promotion: Promotion): string => {
  const verificationStatus = toNormalizedStatus(promotion.verificationStatus);
  if (verificationStatus) return verificationStatus;
  return toNormalizedStatus(promotion.status);
};

export const isPendingPromotion = (promotion: Promotion): boolean => {
  const status = getPromotionVerificationStatus(promotion);
  return status === "PENDING" || status === "SUBMITTED";
};

export const isApprovedPromotion = (promotion: Promotion): boolean => {
  const status = getPromotionVerificationStatus(promotion);
  return status === "APPROVED" || status === "ACTIVE";
};

export const isRejectedPromotion = (promotion: Promotion): boolean =>
  getPromotionVerificationStatus(promotion) === "REJECTED";


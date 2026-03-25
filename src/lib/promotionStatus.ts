import type { Promotion } from "@/lib/api";

const toNormalizedStatus = (value: unknown): string =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const REJECTED_STATUSES = new Set(["REJECTED"]);
const APPROVED_STATUSES = new Set(["APPROVED", "ACTIVE"]);
const PENDING_STATUSES = new Set(["PENDING", "SUBMITTED"]);

const resolvePromotionStatus = (promotion: Promotion): string => {
  const verificationStatus = toNormalizedStatus(promotion.verificationStatus);
  const status = toNormalizedStatus(promotion.status);
  const statuses = [verificationStatus, status].filter(Boolean);

  if (statuses.some((item) => REJECTED_STATUSES.has(item))) {
    return "REJECTED";
  }

  if (statuses.some((item) => APPROVED_STATUSES.has(item))) {
    return "APPROVED";
  }

  if (statuses.some((item) => PENDING_STATUSES.has(item))) {
    return "PENDING";
  }

  return verificationStatus || status;
};

export const getPromotionVerificationStatus = (promotion: Promotion): string => {
  return resolvePromotionStatus(promotion);
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

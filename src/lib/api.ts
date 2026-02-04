import { clearSession, loadSession, saveSession, type AuthSession } from "@/lib/session";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type PageResponse<T> = {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const buildUrl = (path: string) => {
  if (path.startsWith("http")) {
    return path;
  }
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
};

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const refreshSession = async (refreshToken: string): Promise<AuthSession | null> => {
  const response = await fetch(buildUrl(`/api/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const payload = (await parseJson(response)) as ApiResponse<AuthSession> | null;

  if (!response.ok || !payload?.success) {
    return null;
  }

  return payload.data;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const session = loadSession();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth && session?.accessToken) {
    headers.set("Authorization", `${session.tokenType} ${session.accessToken}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401 && session?.refreshToken && !options.skipRefresh) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) {
      saveSession(refreshed);
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    clearSession();
  }

  const payload = (await parseJson(response)) as ApiResponse<T> | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.message ?? response.statusText);
  }

  if (!payload.success) {
    throw new Error(payload.message ?? "Request failed");
  }

  return payload.data;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  email: string;
  fullName: string;
  userRole: string;
  verified: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
  mfaCode?: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  role: string;
};

export type BusinessCreateRequest = {
  ownerId: number;
  businessName: string;
  description: string;
  contactEmail: string;
  phoneNumber: string;
  category: string;
  websiteUrl?: string;
  address: string;
  logoUrl: string;
  city: string;
  country: string;
};

export type Business = {
  id: number;
  ownerId: number;
  ownerName: string;
  businessName: string;
  description: string;
  contactEmail: string;
  phoneNumber: string;
  category: string;
  websiteUrl: string;
  address: string;
  city: string;
  country: string;
  businessVerificationStatus: string;
  verified: boolean;
  createdAt: string;
  verifiedAt: string;
};

export type BusinessVerificationRequest = {
  businessId: number;
  vatNumber: string;
  tinNumber: string;
  ownerNationalId: string;
  supportingDocumentsUrl?: string;
};

export type Promotion = {
  id: number;
  businessId: number;
  businessName: string;
  categoryId: number;
  categoryName: string;
  title: string;
  description: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  promoCode: string;
  discountType: string;
  discountValue: number;
  termsAndConditions: string;
  location: string;
  status: string;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Event = {
  id: number;
  businessId: number;
  businessName: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  perks: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedPromotion = {
  promotionId: number;
  promotionTitle: string;
  businessName: string;
  savedAt: string;
};

export type NotificationItem = {
  id: number;
  channel: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type PlatformAnalytics = {
  totalUsers: number;
  totalBusinesses: number;
  verifiedBusinesses: number;
  pendingBusinesses: number;
  rejectedBusinesses: number;
  totalPromotions: number;
  pendingPromotions: number;
  approvedPromotions: number;
  rejectedPromotions: number;
  activePromotions: number;
  flaggedPromotions: number;
  totalReports: number;
  openReports: number;
  resolvedReports: number;
  promotionViews: number;
  promotionClicks: number;
  promotionRedemptions: number;
  clickThroughRate: number;
  redemptionRate: number;
  platformTrustScore: number;
};

export const api = {
  login: (payload: LoginRequest) =>
    apiRequest<AuthPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    }),
  register: (payload: RegisterRequest) =>
    apiRequest<AuthPayload>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    }),
  logout: (refreshToken: string) =>
    apiRequest<void>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  getPromotions: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiRequest<PageResponse<Promotion>>(`/api/promotions${query}`, { skipAuth: true });
  },
  getPromotion: (id: string | number) =>
    apiRequest<Promotion>(`/api/promotions/${id}`, { skipAuth: true }),
  trackPromotionView: (id: string | number) =>
    apiRequest(`/api/promotions/${id}/view`, { method: "POST", skipAuth: true }),
  trackPromotionClick: (id: string | number) =>
    apiRequest(`/api/promotions/${id}/click`, { method: "POST", skipAuth: true }),
  trackPromotionRedeem: (id: string | number) =>
    apiRequest(`/api/promotions/${id}/redeem`, { method: "POST", skipAuth: true }),
  getEvents: () => apiRequest<PageResponse<Event> | Event[]>("/api/events", { skipAuth: true }),
  getEvent: (id: string | number) => apiRequest<Event>(`/api/events/${id}`, { skipAuth: true }),
  getSavedPromotions: () => apiRequest<SavedPromotion[]>("/api/users/saved-promotions"),
  savePromotion: (promotionId: string | number) =>
    apiRequest(`/api/users/saved-promotions/${promotionId}`, { method: "POST" }),
  removeSavedPromotion: (promotionId: string | number) =>
    apiRequest(`/api/users/saved-promotions/${promotionId}`, { method: "DELETE" }),
  getNotifications: () => apiRequest<NotificationItem[]>("/api/users/notifications"),
  updateUser: (id: number, payload: { fullName: string; password?: string; profileImageURL?: string }) =>
    apiRequest(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  changePassword: (
    id: number,
    payload: { currentPassword: string; newPassword: string; confirmNewPassword: string }
  ) => apiRequest(`/api/users/${id}/change-password`, { method: "POST", body: JSON.stringify(payload) }),
  createBusiness: (payload: BusinessCreateRequest) =>
    apiRequest<Business>(`/api/businesses`, { method: "POST", body: JSON.stringify(payload) }),
  requestBusinessVerification: (payload: BusinessVerificationRequest) =>
    apiRequest(`/api/business-verification`, { method: "POST", body: JSON.stringify(payload) }),
  reportPromotion: (payload: { promotionId: number; reason: string; details?: string }) =>
    apiRequest(`/api/reports`, { method: "POST", body: JSON.stringify(payload) }),
  getPlatformAnalytics: () => apiRequest<PlatformAnalytics>("/api/analytics/platform"),
};

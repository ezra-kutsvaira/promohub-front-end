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

const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const API_BASE_URL = RAW_API_BASE_URL
  ? RAW_API_BASE_URL.startsWith("http") || RAW_API_BASE_URL.startsWith("/")
    ? RAW_API_BASE_URL.replace(/\/$/, "")
    : `/${RAW_API_BASE_URL.replace(/\/$/, "")}`
  : "";
const API_PROXY_TARGET = (import.meta.env.VITE_API_PROXY_TARGET ?? "").trim();
const SHOULD_PREFER_DEV_PROXY = import.meta.env.DEV && Boolean(API_PROXY_TARGET)

const buildUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  if(SHOULD_PREFER_DEV_PROXY && path.startsWith("/api")) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE_URL) return normalizedPath;
  return `${API_BASE_URL}${normalizedPath}`
};

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

class ApiError extends Error{
  status:number;

  constructor(message: string , status: number){
      super(message);
      this.message = message;
      this.status = status;
  }
}

const NETWORK_ERROR_MESSAGE =
  "Unable to reach the API server. Make sure the backend is running and your VITE_API_BASE_URL or VITE_API_PROXY_TARGET is configured correctly.";

const isNotFoundError = (error: unknown) => {
 if (error instanceof ApiError) {
    if (error.status === 404) return true;
    const normalizedMessage = error.message.toLowerCase();
    return normalizedMessage === "not found" || normalizedMessage.includes("404") || normalizedMessage.includes("no static resource");
  }
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.toLowerCase();
  return normalizedMessage === "not found" || normalizedMessage.includes("404") || normalizedMessage.includes("no static resource");
};


const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isApiResponseEnvelope = <T>(payload: unknown): payload is ApiResponse<T> => {
  if (!payload || typeof payload !== "object") return false;
  return "success" in payload && "data" in payload;
};

const getErrorMessageFromPayload = (payload: unknown, fallbackMessage: string) => {
  if (!payload || typeof payload !== "object") return fallbackMessage;

  const message = "message" in payload ? payload.message : undefined;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  const error = "error" in payload ? payload.error : undefined;
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallbackMessage;
};

const performRequest = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw error;
  }
};

const refreshSession = async (refreshToken: string): Promise<AuthSession | null> => {
  const response = await performRequest(buildUrl(`/api/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const payload = (await parseJson(response)) as ApiResponse<AuthSession> | null;
  if (!response.ok || !payload?.success) return null;
  return payload.data;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const session = loadSession();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (!options.skipAuth && session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);

  const response = await performRequest(buildUrl(path), { ...options, headers });

  if (response.status === 401 && session?.refreshToken && !options.skipRefresh) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) {
      saveSession(refreshed);
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    clearSession();
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessageFromPayload(payload, response.statusText), response.status);
  }

  if (payload === null) {
    return undefined as T;
  }

  if (isApiResponseEnvelope<T>(payload)) {
    if (!payload.success) throw new Error(payload.message ?? "Request failed");
    return payload.data;
  }

  return payload as T;
};

const apiRequestWithFallback = async <T>(
  primaryPath: string,
  fallbackPath: string,
  options: RequestOptions = {}
): Promise<T> => {
  try {
    return await apiRequest<T>(primaryPath, options);
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiRequest<T>(fallbackPath, options);
    }
    throw error;
  }
};

const apiRequestWithAlternatives = async <T>(
  paths: string[],
  options: RequestOptions = {},
  retryStatuses: number[] = [404]
): Promise<T> => {
  if (paths.length === 0) {
    throw new Error("No API paths provided");
  }

  let lastError: unknown;
  for (let index = 0; index < paths.length; index += 1) {
    try {
      return await apiRequest<T>(paths[index], options);
    } catch (error) {
      lastError = error;
      const shouldRetryForStatus = error instanceof ApiError && retryStatuses.includes(error.status);
      const shouldRetryForNotFoundMessage = isNotFoundError(error);
      const hasMoreCandidates = index < paths.length - 1;
       if ((shouldRetryForStatus || shouldRetryForNotFoundMessage) && hasMoreCandidates) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Request failed");
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

export type LoginRequest = { email: string; password: string; mfaCode?: string };

export type RegisterRequest = { fullName: string; email: string; password: string; role: string };

export type UserProfile = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  verified: boolean;
  createdAt?: string;
};

export type BusinessCreateRequest = {
  ownerId: number;
  businessName: string;
  description: string;
  contactEmail: string;
  phoneNumber: string;
  category: string;
  categoryCode?: string;
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
  categoryId?: number;
  categoryCode?: string;
  websiteUrl: string;
  address: string;
  city: string;
  country: string;
  businessVerificationStatus: string;
  verified: boolean;
  createdAt: string;
  verifiedAt: string;
};

export type MfaSetupResponse = { secret: string; qrCodeUrl?: string };

export type BusinessVerificationRequest = {
  businessId: number;
  vatNumber: string;
  tinNumber: string;
  ownerNationalId: string;
  supportingDocumentsUrl?: string;
};

export type BusinessVerificationReview = {
  id: number;
  businessId: number;
  status: string;
  vatNumber?: string;
  tinNumber?: string;
  ownerNationalId?: string;
  supportingDocumentsUrl?: string;
  submittedAt?: string;
};

export type Promotion = {
  id: number;
  businessId: number;
  businessName: string;
  categoryId?: number;
  categoryCode?: string;
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
  verificationStatus?: string;
  verifiedAt?: string;
  verifiedById?: number;
  verifiedByEmail?: string;
  verificationNotes?: string;
  rejectionReason?: string;
  flagged: boolean;
  riskScore?: number;
  createdAt: string;
  updatedAt: string;
};

export type PromotionUpsertRequest = {
  businessId: number;
  categoryId?: number;
  categoryCode?: string;
  categoryName?: string;
  title: string;
  description: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  promoCode?: string;
  discountType?: string;
  discountValue?: number;
  termsAndConditions?: string;
  location?: string;
};

export type Category = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
};

export type PromotionEngagement = {
  promotionId: number;
  views: number;
  clicks: number;
  redemptions: number;
  clickThroughRate: number;
  redemptionRate: number;
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

export type EventUpsertRequest = {
  businessId: number;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  perks?: string;
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

export type NotificationSubscription = { id: number; channel: string; destination: string; enabled: boolean };

export type ReportItem = {
  id: number;
  promotionId?: number;
  eventId?: number;
  reason: string;
  details?: string;
  status: string;
  createdAt?: string;
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

export type BusinessAnalytics = {
  businessId: number;
  promotions: number;
  views: number;
  clicks: number;
  redemptions: number;
  engagementRate: number;
};

export type SecurityAuditLog = {
  id: number;
  actorId: number;
  action: string;
  targetType: string;
  targetId?: number;
  createdAt: string;
};

const PUBLIC_PROMOTIONS_BASE_PATH = "/api/promotions";
const BUSINESS_PROMOTIONS_BASE_PATH = "/api/business/promotions";
const BUSINESS_PROMOTIONS_ALIAS_BASE_PATH = "/business/promotions";

const toPromotionArray = (payload: PageResponse<Promotion> | Promotion[] | null | undefined): Promotion[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.content ?? [];
};

export const api = {
  login: (payload: LoginRequest) => apiRequestWithAlternatives<AuthPayload>(
    ["/api/auth/login", "/api/auth/signin", "/api/auth/sign-in", "/auth/login", "/auth/signin"],
    { method: "POST", body: JSON.stringify(payload), skipAuth: true }
  ),
  register: (payload: RegisterRequest) => apiRequestWithAlternatives<AuthPayload>(
    ["/api/auth/register", "/api/auth/signup", "/api/users/register", "/auth/register", "/auth/signup"],
    { method: "POST", body: JSON.stringify(payload), skipAuth: true }
  ),
  logout: (refreshToken: string) => apiRequest<void>("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  requestPasswordReset: (email: string) => apiRequest<void>("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }), skipAuth: true }),
  confirmPasswordReset: (payload: { token: string; newPassword: string; confirmNewPassword: string }) => apiRequest<void>("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify(payload), skipAuth: true }),

  getPromotions: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiRequest<PageResponse<Promotion>>(`${PUBLIC_PROMOTIONS_BASE_PATH}${query}`);
  },

  getBusinessPromotions: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiRequestWithAlternatives<PageResponse<Promotion> | Promotion[]>(
      [
        `${BUSINESS_PROMOTIONS_BASE_PATH}${query}`,
        `${BUSINESS_PROMOTIONS_ALIAS_BASE_PATH}${query}`,
        `/api/promotions${query}`,
      ],
      {},
      [400, 404]
    );
  },

  getCurrentUserBusinessPromotions: async (businessId: number | string, ownerId?: number | string) => {
    const parameterCandidates: Array<Record<string, string> | undefined> = [
      { businessId: String(businessId) },
      { id: String(businessId) },
      ownerId === undefined ? undefined : { ownerId: String(ownerId) },
      ownerId === undefined ? undefined : { userId: String(ownerId) },
      undefined,
    ];

    let lastError: unknown;
    for (const candidate of parameterCandidates) {
      try {
        const response = await api.getBusinessPromotions(candidate);
        const promotions = toPromotionArray(response);

        if (promotions.length === 0 && candidate) {
          continue;
        }

        return promotions.filter((promotion) =>
          String(promotion.businessId) === String(businessId)
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Unable to load business promotions.");
  },


  getPromotion: (id: string | number) => apiRequest<Promotion>(`${PUBLIC_PROMOTIONS_BASE_PATH}/${id}`),
  createPromotion: (payload: PromotionUpsertRequest) => apiRequestWithAlternatives<Promotion>(
    [PUBLIC_PROMOTIONS_BASE_PATH, BUSINESS_PROMOTIONS_BASE_PATH, BUSINESS_PROMOTIONS_ALIAS_BASE_PATH],
    { method: "POST", body: JSON.stringify(payload) },
    [404]
  ),
  updatePromotion: (id: string | number, payload: PromotionUpsertRequest) => apiRequestWithAlternatives<Promotion>(
    [`${BUSINESS_PROMOTIONS_BASE_PATH}/${id}`, `${BUSINESS_PROMOTIONS_ALIAS_BASE_PATH}/${id}`],
    { method: "PUT", body: JSON.stringify(payload) },
    [404]
  ),
  deletePromotion: (id: string | number) => apiRequestWithAlternatives<void>(
    [`${BUSINESS_PROMOTIONS_BASE_PATH}/${id}`, `${BUSINESS_PROMOTIONS_ALIAS_BASE_PATH}/${id}`],
    { method: "DELETE" },
    [404]
  ),
  getPromotionEngagement: (id: string | number) => apiRequestWithAlternatives<PromotionEngagement>(
    [`${BUSINESS_PROMOTIONS_BASE_PATH}/${id}/engagement`, `${BUSINESS_PROMOTIONS_ALIAS_BASE_PATH}/${id}/engagement`],
    {},
    [404]
  ),
  trackPromotionView: (id: string | number) => apiRequest(`${PUBLIC_PROMOTIONS_BASE_PATH}/${id}/view`, { method: "POST", skipAuth: true }),
  trackPromotionClick: (id: string | number) => apiRequest(`${PUBLIC_PROMOTIONS_BASE_PATH}/${id}/click`, { method: "POST", skipAuth: true }),
  trackPromotionRedeem: (id: string | number) => apiRequest(`${PUBLIC_PROMOTIONS_BASE_PATH}/${id}/redeem`, { method: "POST", skipAuth: true }),

  getEvents: () => apiRequest<PageResponse<Event> | Event[]>("/api/events", { skipAuth: true }),
  getEvent: (id: string | number) => apiRequest<Event>(`/api/events/${id}`, { skipAuth: true }),
  createEvent: (payload: EventUpsertRequest) => apiRequest<Event>("/api/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (id: string | number, payload: EventUpsertRequest) => apiRequest<Event>(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEvent: (id: string | number) => apiRequest<void>(`/api/events/${id}`, { method: "DELETE" }),

  getSavedPromotions: () => apiRequest<SavedPromotion[]>("/api/users/saved-promotions"),
  savePromotion: (promotionId: string | number) => apiRequest(`/api/users/saved-promotions/${promotionId}`, { method: "POST" }),
  removeSavedPromotion: (promotionId: string | number) => apiRequest(`/api/users/saved-promotions/${promotionId}`, { method: "DELETE" }),
  getNotifications: () => apiRequest<NotificationItem[]>("/api/users/notifications"),
  markNotificationRead: (notificationId: number | string) => apiRequest<void>(`/api/users/notifications/${notificationId}/read`, { method: "POST" }),
  getNotificationSubscriptions: () => apiRequest<NotificationSubscription[]>("/api/users/notification-subscriptions"),
  createNotificationSubscription: (payload: { channel: string; destination: string }) => apiRequest<NotificationSubscription>("/api/users/notification-subscriptions", { method: "POST", body: JSON.stringify(payload) }),
  deleteNotificationSubscription: (subscriptionId: number | string) => apiRequest<void>(`/api/users/notification-subscriptions/${subscriptionId}`, { method: "DELETE" }),

  updateUser: (id: number, payload: { fullName: string; password?: string; profileImageURL?: string }) => apiRequest(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  getUser: (id: number | string) => apiRequest<UserProfile>(`/api/users/${id}`),
  getUsers: () => apiRequest<UserProfile[]>("/api/users"),
  getUserByEmail: (email: string) => apiRequest<UserProfile>(`/api/users/by-email?email=${encodeURIComponent(email)}`),
  verifyUser: (id: number | string) => apiRequest<void>(`/api/users/${id}/verify`, { method: "POST" }),
  deleteUser: (id: number | string) => apiRequest<void>(`/api/users/${id}`, { method: "DELETE" }),
  changePassword: (id: number, payload: { currentPassword: string; newPassword: string; confirmNewPassword: string }) => apiRequest(`/api/users/${id}/change-password`, { method: "POST", body: JSON.stringify(payload) }),
  setupMfa: () => apiRequest<MfaSetupResponse>("/api/users/mfa/setup", { method: "POST" }),
  enableMfa: (code: string) => apiRequest<void>("/api/users/mfa/enable", { method: "POST", body: JSON.stringify({ code }) }),
  disableMfa: (code: string) => apiRequest<void>("/api/users/mfa/disable", { method: "POST", body: JSON.stringify({ code }) }),

  createBusiness: (payload: BusinessCreateRequest) => apiRequest<Business>(`/api/businesses`, { method: "POST", body: JSON.stringify(payload) }),
  getBusiness: (id: number | string) => apiRequest<Business>(`/api/businesses/${id}`),
  getBusinesses: () => apiRequest<PageResponse<Business> | Business[]>("/api/businesses"),
  getCategories: () => apiRequest<Category[]>("/api/categories", { skipAuth: true }),
  getCurrentUserBusiness: (ownerId?: number | string) => {
     const currentUserPaths = [
      "/api/businesses/me",
      "/api/businesses/my",
      "/api/businesses/current",
    ];

    const ownerScopedPaths = ownerId === undefined
      ? []
      : [
          `/api/businesses/owner/${ownerId}`,
          `/api/businesses/owner?ownerId=${encodeURIComponent(String(ownerId))}`,
          `/api/owners/${ownerId}/business`,
      ];


    return apiRequestWithAlternatives<Business>(
      ownerId === undefined
        ? currentUserPaths
      : [...currentUserPaths, ...ownerScopedPaths],
      {},
      [400, 404]
      ).catch(async (error) => {
      if (ownerId === undefined) {
        throw error;
      }

      const businesses = await api.getBusinesses();
      const businessList = Array.isArray(businesses) ? businesses : businesses.content;
      const ownerBusiness = businessList.find((business) => String(business.ownerId) === String(ownerId));

      if (ownerBusiness) {
        return ownerBusiness;
      }

      throw error;
    });
  },
  deleteBusiness: (id: number | string) => apiRequest<void>(`/api/businesses/${id}`, { method: "DELETE" }),
  requestBusinessVerification: (payload: BusinessVerificationRequest) => apiRequestWithAlternatives(
    [
      "/api/business-verification",
      "/api/business-verifications",
      `/api/businesses/${payload.businessId}/verification`,
      `/api/businesses/${payload.businessId}/verify`,
      `/api/businesses/${payload.businessId}/verification-request`,
    ],
    { method: "POST", body: JSON.stringify(payload) }
  ),
  getBusinessVerification: (id: number | string) => apiRequestWithFallback<BusinessVerificationReview>(
    `/api/business-verification/${id}`,
    `/api/business-verifications/${id}`
  ),
  approveBusinessVerification: (id: number | string) => apiRequestWithFallback<void>(
    `/api/business-verification/${id}/approve`,
    `/api/business-verifications/${id}/approve`,
    { method: "POST" }
  ),
  rejectBusinessVerification: (id: number | string, reason?: string) => apiRequestWithFallback<void>(
    `/api/business-verification/${id}/reject`,
    `/api/business-verifications/${id}/reject`,
    { method: "POST", body: JSON.stringify(reason ? { reason } : {}) }
  ),

  reportPromotion: (payload: { promotionId: number; reason: string; details?: string }) => apiRequest(`/api/reports`, { method: "POST", body: JSON.stringify(payload) }),
  getReport: (id: number | string) => apiRequest<ReportItem>(`/api/reports/${id}`),
  getReports: () => apiRequest<ReportItem[]>("/api/reports"),
  resolveReport: (id: number | string, resolution?: string) => apiRequest<void>(`/api/reports/${id}/resolve`, { method: "POST", body: JSON.stringify(resolution ? { resolution } : {}) }),

  getPlatformAnalytics: () => apiRequest<PlatformAnalytics>("/api/analytics/platform"),
  getBusinessAnalytics: (businessId: number | string) => apiRequest<BusinessAnalytics>(`/api/analytics/business/${businessId}`),

  getAdminPromotions: () => apiRequest<Promotion[]>("/api/admin/promotions"),
  getAdminEvents: () => apiRequest<Event[]>("/api/admin/events"),
  getAdminBusinesses: () => apiRequest<Business[]>("/api/admin/businesses"),
  getSecurityAuditLogs: () => apiRequest<SecurityAuditLog[]>("/api/admin/security-audit-logs"),
};

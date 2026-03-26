import {
  clearSession,
  clearStagedSession,
  hasStagedSession,
  loadRequestSession,
  saveSession,
  stageSession,
  type AuthSession,
} from "@/lib/session";

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

//Changes to take note
const appendQueryParam = (path: string, key: string, value?: string) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return path;

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(trimmedValue)}`;
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

const isMethodNotSupportedError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes("method not allowed") ||
    normalizedMessage.includes("request method") && normalizedMessage.includes("not supported") ||
    normalizedMessage.includes("http request method not supported") ||
    normalizedMessage.includes("405")
  );
};

const isPathParameterTypeMismatchError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes("failed to convert value of type") ||
    normalizedMessage.includes("method parameter") && normalizedMessage.includes("required type") ||
    normalizedMessage.includes("input string: \"me\"")
  );
};

const isUnauthorizedError = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes("401") ||
    normalizedMessage.includes("403") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("forbidden")
  );
};

const isUnsupportedMediaTypeError = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.status === 415;
  }
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.toLowerCase();
  return normalizedMessage.includes("415") || normalizedMessage.includes("unsupported media type");
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
  const session = loadRequestSession();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!options.skipAuth && session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);

  const response = await performRequest(buildUrl(path), { ...options, headers });

  if (response.status === 401 && session?.refreshToken && !options.skipRefresh) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) {
      if (hasStagedSession()) {
        stageSession(refreshed);
      } else {
        saveSession(refreshed);
      }
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    if (hasStagedSession()) {
      clearStagedSession();
    } else {
      clearSession();
    }
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

export const apiBlobRequest = async (path: string, options: RequestOptions = {}): Promise<Blob> => {
  const session = loadRequestSession();
  const headers = new Headers(options.headers ?? {});

  if (!options.skipAuth && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }


  const response = await performRequest(buildUrl(path), { ...options, headers });

  if (response.status === 401 && session?.refreshToken && !options.skipRefresh) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) {
      if (hasStagedSession()) {
        stageSession(refreshed);
      } else {
        saveSession(refreshed);
      }
      return apiBlobRequest(path, { ...options, skipRefresh: true });
    }
    if (hasStagedSession()) {
      clearStagedSession();
    } else {
      clearSession();
    }
  }

  if (!response.ok) {
    const payload = await parseJson(response);
    throw new ApiError(getErrorMessageFromPayload(payload, response.statusText), response.status);
  }

  return response.blob();
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
      const shouldRetryForPathParamMismatch = isPathParameterTypeMismatchError(error);
      const hasMoreCandidates = index < paths.length - 1;
       if ((shouldRetryForStatus || shouldRetryForNotFoundMessage || shouldRetryForPathParamMismatch) && hasMoreCandidates) {
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

const apiRequestWithMethodAndPathAlternatives = async <T>(
  paths: string[],
  methods: string[],
  body?: string,
  retryStatuses: number[] = [404, 405]
): Promise<T> => {
  if (paths.length === 0) {
    throw new Error("No API paths provided");
  }

  if (methods.length === 0) {
    throw new Error("No HTTP methods provided");
  }

  let lastError: unknown;

  for (const method of methods) {
    for (let index = 0; index < paths.length; index += 1) {
      try {
        return await apiRequest<T>(paths[index], { method, ...(body ? { body } : {}) });
      } catch (error) {
        lastError = error;
        const shouldRetryForStatus = error instanceof ApiError && retryStatuses.includes(error.status);
        const shouldRetryForNotFoundMessage = isNotFoundError(error);
        const shouldRetryForMethodMessage = isMethodNotSupportedError(error);
        const shouldRetry = shouldRetryForStatus || shouldRetryForNotFoundMessage || shouldRetryForMethodMessage;
        const hasMoreCandidates = index < paths.length - 1;

        if (shouldRetry && hasMoreCandidates) {
          continue;
        }

        if (shouldRetry && method !== methods[methods.length - 1]) {
          break;
        }

        throw error;
      }
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
  taxClearanceDocumentUrl: string;
  certifiedRegistrantIdDocumentUrl: string;
  businessRegistrationCertificateUrl?: string;
  proofOfBusinessAddressDocumentUrl?: string;
};

export type BusinessDocumentType =
  | "TAX_CLEARANCE"
  | "CERTIFIED_REGISTRANT_ID"
  | "BUSINESS_REGISTRATION_CERTIFICATE"
  | "PROOF_OF_BUSINESS_ADDRESS"
  | "OPERATING_LICENSE";

export type UploadedBusinessDocument = {
  documentType: BusinessDocumentType;
  fileName: string;
  documentUrl: string;
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
  reviewHistory?: unknown[];
  reviewerHistory?: unknown[];
  notesHistory?: unknown[];
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

const toBusinessArray = (payload: PageResponse<Business> | Business[] | null | undefined): Business[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.content ?? [];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getStringFromCandidates = (
  source: Record<string, unknown> | null,
  candidates: string[],
): string | undefined => {
  if (!source) return undefined;

  for (const candidate of candidates) {
    const value = source[candidate];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

const collectNestedRecords = (
  value: unknown,
  seen = new Set<Record<string, unknown>>()
): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectNestedRecords(entry, seen));
  }

  if (!asRecord(value)) return [];
  if (seen.has(value)) return [];

  seen.add(value);
  const records: Record<string, unknown>[] = [value];

  Object.values(value).forEach((entry) => {
    records.push(...collectNestedRecords(entry, seen));
  });

  return records;
};

const pickFirstMatchingValue = (
  sources: Record<string, unknown>[],
  candidates: string[]
): unknown => {
  for (const source of sources) {
    for (const candidate of candidates) {
      const value = source[candidate];
      if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
        return value;
      }
    }
  }

  return undefined;
};

const normalizeBusinessVerificationReview = (payload: unknown): BusinessVerificationReview => {
  const nestedSources = collectNestedRecords(payload);

  const pickString = (candidates: string[]) => {
    for (const source of nestedSources) {
      const value = getStringFromCandidates(source, candidates);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  };

  const pickArray = (candidates: string[]) => {
    for (const source of nestedSources) {
      for (const candidate of candidates) {
        const value = source[candidate];
        if (Array.isArray(value)) {
          return value;
        }
      }
    }
    return undefined;
  };

  const idValue = pickFirstMatchingValue(nestedSources, [
    "id",
    "verificationId",
    "verification_id",
    "businessVerificationId",
    "business_verification_id",
    "businessVerificationRecordId",
    "business_verification_record_id",
    "reviewId",
    "review_id",
    "recordId",
    "record_id",
  ]);
  const businessIdValue = pickFirstMatchingValue(nestedSources, ["businessId", "business_id", "businessID", "business_id_fk", "id"]);

  return {
    id: Number(idValue ?? businessIdValue ?? 0),
    businessId: Number(businessIdValue ?? idValue ?? 0),
    status: pickString(["status", "verificationStatus", "verification_status", "businessVerificationStatus", "business_verification_status"]) ?? "",
    vatNumber: pickString(["vatNumber", "vat_number", "vatNo", "vat_no", "vat", "vatId", "vat_id", "businessVatNumber", "business_vat_number", "vatRegistrationNumber", "vat_registration_number"]),
    tinNumber: pickString(["tinNumber", "tin_number", "tinNo", "tin_no", "tin", "taxIdentificationNumber", "tax_identification_number", "taxTinNumber", "tax_tin_number", "taxPayerNumber", "tax_payer_number"]),
    ownerNationalId: pickString(["ownerNationalId", "owner_national_id", "nationalId", "national_id", "ownerIdNumber", "owner_id_number", "nationalIdNumber", "national_id_number", "ownerNationalID", "owner_nationalID", "ownerNationalIdentityNumber", "owner_national_identity_number"]),
    supportingDocumentsUrl: pickString(["supportingDocumentsUrl", "supporting_documents_url", "documentsUrl", "documents_url", "documentUrl", "document_url", "supportingDocumentUrl"]),
    submittedAt: pickString(["submittedAt", "submitted_at", "createdAt", "created_at", "requestedAt", "requested_at"]),
    reviewHistory: pickArray(["reviewHistory"]),
    reviewerHistory: pickArray(["reviewerHistory"]),
    notesHistory: pickArray(["notesHistory"]),
  };
};

const normalizeBusinessVerificationReviewCollection = (
  payload: unknown,
  businessId?: number | string,
): BusinessVerificationReview => {
  const normalizedBusinessId = businessId === undefined ? undefined : String(businessId);
  const candidates = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.content)
      ? payload.content
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : [payload];

  const normalizedCandidates = candidates
    .map((candidate) => normalizeBusinessVerificationReview(candidate))
    .filter((candidate) => candidate.id > 0 || candidate.businessId > 0 || candidate.status || candidate.vatNumber || candidate.tinNumber || candidate.ownerNationalId);

  if (normalizedBusinessId) {
    const businessMatch = normalizedCandidates.find((candidate) => String(candidate.businessId) === normalizedBusinessId);
    if (businessMatch) {
      return businessMatch;
    }
  }

  return normalizedCandidates[0] ?? normalizeBusinessVerificationReview(payload);
};

const toBusinessVerificationRequestBodies = (payload: BusinessVerificationRequest) => {
  const supportingDocumentsUrl = payload.supportingDocumentsUrl?.trim();

  return [
    {
      businessId: payload.businessId,
      vatNumber: payload.vatNumber,
      tinNumber: payload.tinNumber,
      ownerNationalId: payload.ownerNationalId,
      ...(supportingDocumentsUrl ? { supportingDocumentsUrl } : {}),
    },
    {
      business_id: payload.businessId,
      vat_number: payload.vatNumber,
      tin_number: payload.tinNumber,
      owner_national_id: payload.ownerNationalId,
      ...(supportingDocumentsUrl ? { supporting_documents_url: supportingDocumentsUrl } : {}),
    },
    {
      businessId: payload.businessId,
      business_id: payload.businessId,
      vatNumber: payload.vatNumber,
      vat_number: payload.vatNumber,
      vat: payload.vatNumber,
      tinNumber: payload.tinNumber,
      tin_number: payload.tinNumber,
      tin: payload.tinNumber,
      taxIdentificationNumber: payload.tinNumber,
      tax_identification_number: payload.tinNumber,
      ownerNationalId: payload.ownerNationalId,
      owner_national_id: payload.ownerNationalId,
      nationalId: payload.ownerNationalId,
      national_id: payload.ownerNationalId,
      nationalIdNumber: payload.ownerNationalId,
      national_id_number: payload.ownerNationalId,
      ...(supportingDocumentsUrl
        ? {
            supportingDocumentsUrl,
            supporting_documents_url: supportingDocumentsUrl,
            documentUrl: supportingDocumentsUrl,
            document_url: supportingDocumentsUrl,
          }
        : {}),
    },
  ];
};

const toStatusParam = (status: string): string =>
  status.trim().replace(/[-\s]+/g, "_").toUpperCase();

const getPromotionStatus = (promotion: Promotion): string => {
  const verificationStatus = toStatusParam(promotion.verificationStatus ?? "");
  const status = toStatusParam(promotion.status ?? "");
  const statuses = [verificationStatus, status].filter(Boolean);

  if (statuses.includes("REJECTED")) return "REJECTED";
  if (statuses.includes("APPROVED") || statuses.includes("ACTIVE")) return "APPROVED";
  if (statuses.includes("PENDING") || statuses.includes("SUBMITTED")) return "PENDING";

  return verificationStatus || status;
};

const statusAliases: Record<string, string[]> = {
  PENDING: ["PENDING", "SUBMITTED"],
  APPROVED: ["APPROVED", "ACTIVE"],
  REJECTED: ["REJECTED"],
};

const matchesRequestedStatus = (promotion: Promotion, requestedStatus: string): boolean => {
  const normalizedRequestedStatus = toStatusParam(requestedStatus);
  const normalizedPromotionStatus = getPromotionStatus(promotion);
  const aliases = statusAliases[normalizedRequestedStatus] ?? [normalizedRequestedStatus];
  return aliases.includes(normalizedPromotionStatus);
};

const toRegisterRequestBodies = (payload: RegisterRequest) => [
  {
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    role: payload.role,
  },
  {
    name: payload.fullName,
    email: payload.email,
    password: payload.password,
    role: payload.role,
  },
  {
    full_name: payload.fullName,
    email: payload.email,
    password: payload.password,
    role: payload.role,
  },
  {
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    userRole: payload.role,
  },
  {
    full_name: payload.fullName,
    email: payload.email,
    password: payload.password,
    user_role: payload.role,
  },
];

const isEmailAlreadyRegisteredError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("email exists") ||
    normalizedMessage.includes("duplicate") ||
    normalizedMessage.includes("email in use")
  );
};


export const api = {
  login: (payload: LoginRequest) => apiRequestWithAlternatives<AuthPayload>(
    ["/api/auth/login", "/api/auth/signin", "/api/auth/sign-in", "/auth/login", "/auth/signin"],
    { method: "POST", body: JSON.stringify(payload), skipAuth: true }
  ),
  register: async (payload: RegisterRequest) => {
    const paths = ["/api/auth/register", "/api/auth/signup", "/api/users/register", "/auth/register", "/auth/signup"];
    const requestBodies = toRegisterRequestBodies(payload);

    let lastError: unknown;
    for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
      const path = paths[pathIndex];

      for (let bodyIndex = 0; bodyIndex < requestBodies.length; bodyIndex += 1) {
        try {
          return await apiRequest<AuthPayload>(path, {
            method: "POST",
            body: JSON.stringify(requestBodies[bodyIndex]),
            skipAuth: true,
          });
        } catch (error) {
          lastError = error;
          const hasMoreCandidates = pathIndex < paths.length - 1 || bodyIndex < requestBodies.length - 1;
          const shouldRetry =
            isNotFoundError(error) ||
            isMethodNotSupportedError(error) ||
            isPathParameterTypeMismatchError(error) ||
            (error instanceof ApiError && error.status === 400) ||
            (error instanceof ApiError && error.status === 409) ||
            isEmailAlreadyRegisteredError(error);

          if (shouldRetry && hasMoreCandidates) {
            continue;
          }

          throw error;
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Registration failed.");
  },
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
        `/api/promotions${query}`,
        `${BUSINESS_PROMOTIONS_BASE_PATH}${query}`,
        `${BUSINESS_PROMOTIONS_ALIAS_BASE_PATH}${query}`,
       
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

  getCurrentUserBusinessPromotionsByStatus: async (
    businessId: number | string,
    requestedStatus: string,
    ownerId?: number | string
  ) => {
    const status = toStatusParam(requestedStatus);
    const parameterCandidates: Array<Record<string, string> | undefined> = [
      { businessId: String(businessId), verificationStatus: status },
      { businessId: String(businessId), status },
      { id: String(businessId), verificationStatus: status },
      { id: String(businessId), status },
      ownerId === undefined ? undefined : { ownerId: String(ownerId), verificationStatus: status },
      ownerId === undefined ? undefined : { ownerId: String(ownerId), status },
      ownerId === undefined ? undefined : { userId: String(ownerId), verificationStatus: status },
      ownerId === undefined ? undefined : { userId: String(ownerId), status },
      { verificationStatus: status },
      { status },
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
  updatePromotion: async (id: string | number, payload: PromotionUpsertRequest) => {
    const normalizedPromotionId = Number(id);
    const promotionIdFields = Number.isNaN(normalizedPromotionId)
      ? {
          promotionId: id,
          promotion_id: id,
          id,
        }
      : {
          promotionId: normalizedPromotionId,
          promotion_id: normalizedPromotionId,
          id: normalizedPromotionId,
        };

    const bodyCandidates = [
      payload,
      { ...payload, ...promotionIdFields },
    ];

    let lastError: unknown;
    for (const bodyCandidate of bodyCandidates) {
      try {
        return await apiRequestWithMethodAndPathAlternatives<Promotion>(
          [
            `${PUBLIC_PROMOTIONS_BASE_PATH}/${id}`,
            `${BUSINESS_PROMOTIONS_BASE_PATH}/${id}`,
            `${BUSINESS_PROMOTIONS_ALIAS_BASE_PATH}/${id}`,
          ],
          ["PATCH", "PUT"],
          JSON.stringify(bodyCandidate),
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Unable to update promotion.");
  },
  resubmitPromotion: async (id: string | number, payload?: PromotionUpsertRequest) => {
    const basePaths = [
      PUBLIC_PROMOTIONS_BASE_PATH,
      BUSINESS_PROMOTIONS_BASE_PATH,
      BUSINESS_PROMOTIONS_ALIAS_BASE_PATH,
    ];
    const submitPaths = basePaths.flatMap((basePath) => [
      `${basePath}/${id}/resubmit`,
      `${basePath}/${id}/submit`,
      `${basePath}/${id}/verification/resubmit`,
      `${basePath}/${id}/verification/submit`,
    ]);

    const normalizedPromotionId = Number(id);
    const promotionIdFields = Number.isNaN(normalizedPromotionId)
      ? {
          promotionId: id,
          promotion_id: id,
          id,
        }
      : {
          promotionId: normalizedPromotionId,
          promotion_id: normalizedPromotionId,
          id: normalizedPromotionId,
        };

    const bodyCandidates = payload
      ? [
          { ...payload, ...promotionIdFields },
          { ...payload, ...promotionIdFields, status: "PENDING" },
          { ...payload, ...promotionIdFields, status: "SUBMITTED" },
          { ...payload, ...promotionIdFields, verificationStatus: "PENDING" },
          { ...payload, ...promotionIdFields, status: "PENDING", verificationStatus: "PENDING" },
          { ...payload, ...promotionIdFields, status: "SUBMITTED", verificationStatus: "PENDING" },
        ]
      : [undefined];

    const methods = ["POST", "PATCH", "PUT"];

    let lastError: unknown;
    for (const bodyCandidate of bodyCandidates) {
      try {
        return await apiRequestWithMethodAndPathAlternatives<Promotion>(
          submitPaths,
          methods,
          bodyCandidate ? JSON.stringify(bodyCandidate) : undefined,
          [400, 404, 405]
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (payload) {
      return api.updatePromotion(id, {
        ...payload,
        status: "PENDING",
        verificationStatus: "PENDING",
      } as PromotionUpsertRequest);
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Unable to re-submit promotion.");
  },
  deletePromotion: (id: string | number) => apiRequestWithAlternatives<void>(
     [
      `${BUSINESS_PROMOTIONS_BASE_PATH}/${id}`,
      `${BUSINESS_PROMOTIONS_ALIAS_BASE_PATH}/${id}`,
      `${PUBLIC_PROMOTIONS_BASE_PATH}/${id}`,
      `/api/admin/promotions/${id}`,
    ],
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
  deleteCurrentUser: () =>
    apiRequestWithMethodAndPathAlternatives<void>(
      ["/api/users/me", "/api/users/self"],
      ["DELETE"],
      undefined,
      [400, 404, 405]
    ),
  changePassword: (id: number, payload: { currentPassword: string; newPassword: string; confirmNewPassword: string }) => apiRequest(`/api/users/${id}/change-password`, { method: "POST", body: JSON.stringify(payload) }),
  setupMfa: () => apiRequest<MfaSetupResponse>("/api/users/mfa/setup", { method: "POST" }),
  enableMfa: (code: string) => apiRequest<void>("/api/users/mfa/enable", { method: "POST", body: JSON.stringify({ code }) }),
  disableMfa: (code: string) => apiRequest<void>("/api/users/mfa/disable", { method: "POST", body: JSON.stringify({ code }) }),

  createBusiness: async (payload: BusinessCreateRequest) => {
    try {
      return await apiRequest<Business>(`/api/businesses`, { method: "POST", body: JSON.stringify(payload) });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new Error(
          "Business profile creation API is not available. Backend must expose POST /api/businesses to create the business record after signup."
        );
      }

      if (isMethodNotSupportedError(error)) {
        throw new Error(
          "Business profile creation endpoint exists but does not accept POST. Backend must allow POST /api/businesses for business-owner signup."
        );
      }

      if (error instanceof ApiError && error.status === 400) {
        throw new Error(
          "Business profile creation was rejected by the backend. Confirm POST /api/businesses accepts ownerId, businessName, description, contactEmail, phoneNumber, category/categoryCode, address, city, country, logoUrl, and the uploaded document URL fields."
        );
      }

      if (isUnauthorizedError(error)) {
        throw new Error(
          "Business profile creation was rejected as unauthorized. Confirm POST /api/businesses accepts the new account's access token immediately after signup and that the registered user has the BUSINESS_OWNER role required to create a business profile."
        );
      }

      throw error;
    }
  },
  uploadBusinessDocument: async (documentType: BusinessDocumentType, file: File) => {
    const uploadPaths = [
      "/api/businesses/documents/upload",
      "/api/business-documents/upload",
      "/api/business-verification/documents/upload",
      "/api/business-verifications/documents/upload",
    ];

  const queryPathCandidates = uploadPaths.map((path) => appendQueryParam(path, "documentType", documentType));
    const bodyKeyCandidates = ["file", "document", "documentFile"];

    let lastError: unknown;

    for (const path of queryPathCandidates) {
      for (const bodyKey of bodyKeyCandidates) {
        try {
          const body = new FormData();
          body.append(bodyKey, file);
          return await apiRequest<UploadedBusinessDocument>(path, { method: "POST", body });
        } catch (error) {
          lastError = error;
          const shouldRetry =
            isNotFoundError(error) ||
            isMethodNotSupportedError(error) ||
            (error instanceof ApiError && [400, 404, 405, 415].includes(error.status));

          if (!shouldRetry) {
            throw error;
          }
        }
      }
    }

    for (const path of uploadPaths) {
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("documentType", documentType);
        return await apiRequest<UploadedBusinessDocument>(path, { method: "POST", body });
      } catch (error) {
        lastError = error;
        const shouldRetry =
          isNotFoundError(error) ||
          isMethodNotSupportedError(error) ||
          (error instanceof ApiError && [400, 404, 405, 415].includes(error.status));

        if (!shouldRetry) {
          throw error;
        }
      }
    }

    if (lastError instanceof Error) {
      if (isNotFoundError(lastError)) {
        throw new Error(
          "Business document upload API is not available. Backend must expose an authenticated multipart POST endpoint such as /api/businesses/documents/upload and return a documentUrl."
        );
      }

      if (isMethodNotSupportedError(lastError)) {
        throw new Error(
          "Business document upload endpoint exists but does not accept POST. Backend must accept multipart/form-data POST requests for business verification documents."
        );
      }

      if (isUnsupportedMediaTypeError(lastError)) {
        throw new Error(
          "Business document upload endpoint rejected multipart/form-data. Backend must accept a multipart file field plus documentType."
        );
      }

      if (isUnauthorizedError(lastError)) {
        throw new Error(
          "Business document upload was rejected as unauthorized. Confirm the register response returns a usable access token and that the upload endpoint accepts authenticated business-owner requests immediately after signup."
        );
      }

      throw lastError;
    }

    throw new Error("Unable to upload business verification document.");
  },
  
  getBusinessDocumentBlob: (ownerId: number, fileName: string) =>
    apiBlobRequest(`/api/businesses/documents/${ownerId}/${encodeURIComponent(fileName)}`),
  getProtectedDocumentBlob: (documentUrl: string) => apiBlobRequest(documentUrl),
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

      if (isNotFoundError(error)) {
        throw new Error(
          "No business profile was found for this account. The login may exist, but the business registration did not complete successfully on the backend."
        );
      }

      throw error;
    });
  },
  deleteBusiness: (id: number | string) => apiRequest<void>(`/api/businesses/${id}`, { method: "DELETE" }),
  requestBusinessVerification: async (payload: BusinessVerificationRequest) => {
    const paths = [
      "/api/business-verification",
      "/api/business-verifications",
      `/api/businesses/${payload.businessId}/verification`,
      `/api/businesses/${payload.businessId}/verify`,
      `/api/businesses/${payload.businessId}/verification-request`,
    ];

    let lastError: unknown;
    for (const body of toBusinessVerificationRequestBodies(payload)) {
      try {
        return await apiRequestWithAlternatives(
          paths,
          { method: "POST", body: JSON.stringify(body) }
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Unable to submit business verification.");
  },
/*
  getBusinessVerification: async (id: number | string) => normalizeBusinessVerificationReview(
    await apiRequestWithAlternatives<unknown>(
      [
        `/api/business-verification/${id}`,
        `/api/business-verifications/${id}`,
        `/api/businesses/${id}/verification`,
        `/api/businesses/${id}/business-verification`,
        `/api/admin/businesses/${id}/verification`,
      ]
    )
  ),
  */
  getBusinessVerification: async (id: number | string) => {
    const normalizedBusinessId = String(id);
    const businessScopedPaths = [
      `/api/business-verification/${id}`,
      `/api/business-verifications/${id}`,
      `/api/businesses/${id}/verification`,
      `/api/businesses/${id}/business-verification`,
      `/api/admin/businesses/${id}/verification`,
      `/api/admin/business-verification/${id}`,
      `/api/admin/business-verifications/${id}`,
      `/api/business-verification?businessId=${encodeURIComponent(normalizedBusinessId)}`,
      `/api/business-verification?business_id=${encodeURIComponent(normalizedBusinessId)}`,
      `/api/business-verifications?businessId=${encodeURIComponent(normalizedBusinessId)}`,
      `/api/business-verifications?business_id=${encodeURIComponent(normalizedBusinessId)}`,
      `/api/admin/business-verifications?businessId=${encodeURIComponent(normalizedBusinessId)}`,
      `/api/admin/business-verifications?business_id=${encodeURIComponent(normalizedBusinessId)}`,
    ];

    let lastError: unknown;

    for (const path of businessScopedPaths) {
      try {
        const review = normalizeBusinessVerificationReviewCollection(await apiRequest<unknown>(path), id);
        if (review.businessId > 0 && String(review.businessId) !== normalizedBusinessId) {
          continue;
        }
        return review;
      } catch (error) {
        lastError = error;
        if (isNotFoundError(error)) {
          continue;
        }
        throw error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Unable to load business verification.");
  },
  approveBusinessVerification: (id: number | string) => apiRequestWithFallback<void>(
    `/api/business-verification/${id}/approve`,
    `/api/business-verifications/${id}/approve`,
    { method: "POST"}
  ),
  rejectBusinessVerification: (id: number | string, reason?: string) => apiRequestWithFallback<void>(
    // `/api/business-verification/${id}/reject`,
    //`/api/business-verifications/${id}/reject`,
     appendQueryParam(`/api/business-verification/${id}/reject`, "reason", reason),
    appendQueryParam(`/api/business-verifications/${id}/reject`, "reason", reason),
    { method: "POST", body: JSON.stringify(reason ? { reason } : {}) }
  ),

  //a code block for requesting additional business documents
  requestAdditionalBusinessVerificationDocuments: (id: number | string, note: string) =>
    apiRequestWithAlternatives<void>(
      [
        `/api/business-verification/${id}/request-documents`,
        `/api/business-verifications/${id}/request-documents`,
        `/api/business-verification/${id}/additional-documents`,
        `/api/business-verifications/${id}/additional-documents`, 
      ], 
       { method: "POST", body: JSON.stringify({ note }) }
  ),


  reportPromotion: (payload: { promotionId: number; reason: string; details?: string }) => apiRequest(`/api/reports`, { method: "POST", body: JSON.stringify(payload) }),
  getReport: (id: number | string) => apiRequest<ReportItem>(`/api/reports/${id}`),
  getReports: () => apiRequest<ReportItem[]>("/api/reports"),
  resolveReport: (id: number | string, resolution?: string) => apiRequest<void>(`/api/reports/${id}/resolve`, { method: "POST", body: JSON.stringify(resolution ? { resolution } : {}) }),

  getPlatformAnalytics: () => apiRequest<PlatformAnalytics>("/api/analytics/platform"),
  getBusinessAnalytics: (businessId: number | string) => apiRequest<BusinessAnalytics>(`/api/analytics/business/${businessId}`),

  //getAdminPromotions: () => apiRequest<Promotion[]>("/api/admin/promotions"),
   getAdminPromotions: async () => {
    const payload = await apiRequest<PageResponse<Promotion> | Promotion[]>("/api/admin/promotions");
    return toPromotionArray(payload);
  },
  approvePromotion: (id: number | string) =>
    apiRequestWithAlternatives<void>(
      [
        `/api/admin/promotions/${id}/approve`,
        `/api/admin/promotion/${id}/approve`,
        `/api/promotions/${id}/approve`,
        `/api/promotions/${id}/verification/approve`,
      ],
      { method: "POST" }
    ),
  rejectPromotion: (id: number | string, reason?: string) =>
    apiRequestWithAlternatives<void>(
      [
        //`/api/admin/promotions/${id}/reject`,
        //`/api/admin/promotion/${id}/reject`,
        //`/api/promotions/${id}/reject`,
        //`/api/promotions/${id}/verification/reject`,
        appendQueryParam(`/api/admin/promotions/${id}/reject`, "reason", reason),
        appendQueryParam(`/api/admin/promotion/${id}/reject`, "reason", reason),
        appendQueryParam(`/api/promotions/${id}/reject`, "reason", reason),
        appendQueryParam(`/api/promotions/${id}/verification/reject`, "reason", reason),
      ],
      { method: "POST", body: JSON.stringify(reason ? { reason } : {}) }
    ),
  getAdminPromotionsByStatus: async (requestedStatus: string, adminId?: number | string) => {
    const status = toStatusParam(requestedStatus);
    const parameterCandidates: Array<Record<string, string> | undefined> = [
      { verificationStatus: status },
      { status },
      adminId === undefined ? undefined : { adminId: String(adminId), verificationStatus: status },
      adminId === undefined ? undefined : { adminId: String(adminId), status },
      adminId === undefined ? undefined : { reviewerId: String(adminId), verificationStatus: status },
      adminId === undefined ? undefined : { reviewerId: String(adminId), status },
      adminId === undefined ? undefined : { userId: String(adminId), verificationStatus: status },
      adminId === undefined ? undefined : { userId: String(adminId), status },
      adminId === undefined ? undefined : { id: String(adminId), verificationStatus: status },
      adminId === undefined ? undefined : { id: String(adminId), status },
      undefined,
    ];

    let lastError: unknown;
    for (const candidate of parameterCandidates) {
      try {
        const query = candidate ? `?${new URLSearchParams(candidate).toString()}` : "";
       // const promotions = await apiRequest<Promotion[]>(`/api/admin/promotions${query}`);
       const payload = await apiRequest<PageResponse<Promotion> | Promotion[]>(`/api/admin/promotions${query}`);
       const promotions = toPromotionArray(payload);

        return promotions.filter((promotion) => matchesRequestedStatus(promotion, requestedStatus));
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Unable to load admin promotions.");
  },
  getAdminEvents: () => apiRequest<Event[]>("/api/admin/events"),
  getAdminBusinesses: async () => {
    const payload = await apiRequestWithAlternatives<PageResponse<Business> | Business[]>(
      [
        "/api/admin/businesses",
        "/api/businesses/admin",
        "/api/businesses?scope=admin",
        "/api/businesses",
      ],
      {},
      [400, 404]
    );

    return toBusinessArray(payload);
  },
  getSecurityAuditLogs: () => apiRequest<SecurityAuditLog[]>("/api/admin/security-audit-logs"),
};

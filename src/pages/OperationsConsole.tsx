import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type Business, type BusinessVerificationReview, type Promotion } from "@/lib/api";
import { getPromotionVerificationStatus } from "@/lib/promotionStatus";

type ReviewAction = "APPROVED" | "REJECTED" | "MORE_DOCUMENTS_REQUESTED";
type PromotionStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type QueueStatusFilter = "ALL" | "PENDING" | "MORE_DOCUMENTS_REQUESTED";

type ReviewerHistoryItem = {
  id: string;
  status: string;
  note: string;
  actor: string;
  createdAt: string;
};

type QueueItem = {
  business: Business;
  review: BusinessVerificationReview | null;
  history: ReviewerHistoryItem[];
};

type PromotionQueueItem = {
  promotion: Promotion;
  business: Business | null;
};

const PENDING_STATUSES = new Set([
  "PENDING",
  "IN_REVIEW",
  "SUBMITTED",
  "AWAITING_REVIEW",
  "AWAITING_APPROVAL",
  "UNDER_REVIEW",
  "REVIEW_PENDING",
  "QUEUED",
  "REQUESTED",
  "NEW",
]);
const REQUESTED_MORE_DOCS_STATUSES = new Set(["MORE_DOCUMENTS_REQUESTED", "ADDITIONAL_DOCUMENTS_REQUIRED"]);
const FINAL_REVIEW_STATUSES = new Set(["APPROVED", "VERIFIED", "REJECTED", "DECLINED"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatStatusLabel = (status: string) =>
  status
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatOptionalValue = (value?: string) => {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : "—";
};

const getStringFromRecordCandidates = (source: Record<string, unknown> | null, candidates: string[]) => {
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
  seen = new Set<Record<string, unknown>>(),
): Record<string, unknown>[] => {
  if (!isRecord(value)) return [];
  if (seen.has(value)) return [];

  seen.add(value);
  const records: Record<string, unknown>[] = [value];

  Object.values(value).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((item) => {
        records.push(...collectNestedRecords(item, seen));
      });
      return;
    }

    records.push(...collectNestedRecords(entry, seen));
  });

  return records;
};

const getNestedStringFromCandidates = (value: unknown, candidates: string[]) => {
  const records = collectNestedRecords(value);

  for (const record of records) {
    const match = getStringFromRecordCandidates(record, candidates);
    if (match !== undefined) {
      return match;
    }
  }

  return undefined;
};

const getQueueItemStatus = (item: QueueItem) =>
  String(item.review?.status ?? item.business.businessVerificationStatus ?? "").toUpperCase();

const shouldIncludeQueueItem = (item: QueueItem) => {
  const normalizedStatus = getQueueItemStatus(item);

  if (PENDING_STATUSES.has(normalizedStatus) || REQUESTED_MORE_DOCS_STATUSES.has(normalizedStatus)) {
    return true;
  }

  if (FINAL_REVIEW_STATUSES.has(normalizedStatus)) {
    return false;
  }

  return !item.business.verified;
};

const getVerificationFieldValue = (
  item: QueueItem,
  candidates: string[],
) => (
  getNestedStringFromCandidates(item.review, candidates)
  ?? getNestedStringFromCandidates(item.business, candidates)
);

const extractHistoryFromReview = (review: BusinessVerificationReview | null): ReviewerHistoryItem[] => {
  if (!review) return [];

  const reviewAsRecord = review as unknown as Record<string, unknown>;
  const rawHistory =
    reviewAsRecord.reviewHistory
    ?? reviewAsRecord.reviewerHistory
    ?? reviewAsRecord.notesHistory
    ?? [];
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null;
      }

      const createdAt = typeof entry.createdAt === "string"
        ? entry.createdAt
        : typeof entry.timestamp === "string"
          ? entry.timestamp
          : "";

      return {
        id: String(entry.id ?? `history-${index}`),
        status: typeof entry.status === "string" ? entry.status : "NOTE",
        note: String(entry.note ?? entry.message ?? entry.reason ?? "No note supplied."),
        actor: String(entry.actorName ?? entry.reviewerName ?? entry.createdBy ?? "System"),
        createdAt,
      } satisfies ReviewerHistoryItem;
    })
    .filter((entry): entry is ReviewerHistoryItem => Boolean(entry));
};

const matchesQueueFilter = (status: string, filter: QueueStatusFilter) => {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return PENDING_STATUSES.has(status);
  return REQUESTED_MORE_DOCS_STATUSES.has(status);
};

const matchesPromotionFilter = (status: string, filter: PromotionStatusFilter) => {
  if (filter === "ALL") return true;
  return status === filter;
};

const OperationsConsole = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("ALL");
  const [promotionStatusFilter, setPromotionStatusFilter] = useState<PromotionStatusFilter>("PENDING");
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [requestDocsNote, setRequestDocsNote] = useState("");
  const [moderationReasonByPromotionId, setModerationReasonByPromotionId] = useState<Record<number, string>>({});
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [promotionQueueItems, setPromotionQueueItems] = useState<PromotionQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [promotionActionId, setPromotionActionId] = useState<number | null>(null);

  const loadQueue = useCallback(async () => {
    setIsLoadingQueue(true);

    try {
      const businesses = await api.getAdminBusinesses();

      const businessesWithReviews = await Promise.all(
        businesses.map(async (business) => {
          try {
            const review = await api.getBusinessVerification(business.id);
            return {
              business,
              review,
              history: extractHistoryFromReview(review),
            } satisfies QueueItem;
          } catch {
            return {
              business,
              review: null,
              history: [],
            } satisfies QueueItem;
          }
        })
      );

      const pendingQueue = businessesWithReviews.filter(shouldIncludeQueueItem);

      setQueueItems(pendingQueue);
      setSelectedBusinessId((current) => {
        if (pendingQueue.length === 0) return null;
        if (current !== null && pendingQueue.some((item) => item.business.id === current)) {
          return current;
        }
        return pendingQueue[0].business.id;
      });
    } catch (error) {
      console.error("Unable to load admin verification queue", error);
      toast.error("Unable to load verification queue.");
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  const loadPromotions = useCallback(async () => {
    setIsLoadingPromotions(true);

    try {
      const [businesses, pendingPromotions, approvedPromotions, rejectedPromotions] = await Promise.all([
        api.getAdminBusinesses().catch(() => [] as Business[]),
        api.getAdminPromotionsByStatus("PENDING"),
        api.getAdminPromotionsByStatus("APPROVED"),
        api.getAdminPromotionsByStatus("REJECTED"),
      ]);

      const businessesById = new Map(businesses.map((business) => [business.id, business]));
      const seen = new Set<number>();
      const combinedPromotions = [...pendingPromotions, ...approvedPromotions, ...rejectedPromotions]
        .filter((promotion) => {
          if (seen.has(promotion.id)) return false;
          seen.add(promotion.id);
          return true;
        });

      setPromotionQueueItems(
        combinedPromotions.map((promotion) => ({
          promotion,
          business: businessesById.get(promotion.businessId) ?? null,
        }))
      );
    } catch (error) {
      console.error("Unable to load promotion moderation queue", error);
      toast.error("Unable to load promotion moderation queue.");
    } finally {
      setIsLoadingPromotions(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadQueue(), loadPromotions()]);
  }, [loadPromotions, loadQueue]);

  const selectedQueueItem = useMemo(
    () => queueItems.find((item) => item.business.id === selectedBusinessId) ?? null,
    [queueItems, selectedBusinessId]
  );

  const filteredQueueItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return queueItems.filter((item) => {
      const normalizedStatus = getQueueItemStatus(item);

      if (!matchesQueueFilter(normalizedStatus, statusFilter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        item.business.businessName,
        item.business.ownerName,
        item.business.contactEmail,
        item.business.city,
        item.business.country,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [queueItems, searchTerm, statusFilter]);

  const filteredPromotionQueueItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return promotionQueueItems.filter((item) => {
      const status = getPromotionVerificationStatus(item.promotion).toUpperCase();
      if (!matchesPromotionFilter(status, promotionStatusFilter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        item.promotion.title,
        item.promotion.businessName,
        item.business?.businessName,
        item.business?.ownerName,
        item.business?.contactEmail,
        item.business?.city,
        item.business?.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [promotionQueueItems, promotionStatusFilter, searchTerm]);

  const runReviewAction = async (action: ReviewAction, note: string) => {
    if (!selectedQueueItem) {
      toast.error("Select a business before running an action.");
      return;
    }

    const normalizedNote = note.trim();
    const requiresNote = action !== "APPROVED";

    if (requiresNote && !normalizedNote) {
      toast.error(action === "REJECTED" ? "Please provide a rejection reason." : "Please provide a reviewer note.");
      return;
    }

    const verificationRecordId = selectedQueueItem.review?.id
      ?? selectedQueueItem.review?.businessId
      ?? selectedQueueItem.business.id;
    if (!verificationRecordId) {
      toast.error("No verification record was found for this business.");
      return;
    }

    setIsSubmittingAction(true);

    try {
      if (action === "APPROVED") {
        await api.approveBusinessVerification(verificationRecordId);
      }

      if (action === "REJECTED") {
        await api.rejectBusinessVerification(verificationRecordId, normalizedNote);
      }

      if (action === "MORE_DOCUMENTS_REQUESTED") {
        await api.requestAdditionalBusinessVerificationDocuments(verificationRecordId, normalizedNote);
      }

      setQueueItems((previous) => previous.map((item) => {
        if (item.business.id !== selectedQueueItem.business.id) {
          return item;
        }

        const updatedStatus = action;
         const localHistoryItem: ReviewerHistoryItem = {
          id: `local-${Date.now()}`,
          status: updatedStatus,
          note: normalizedNote || "No Reviewer Note Provided.",
          actor: "You",
          createdAt: new Date().toISOString(),
        };

        return {
          ...item,
          review: item.review
            ? {
                ...item.review,
                status: updatedStatus,
              }
            : {
                id: item.business.id,
                businessId: item.business.id,
                status: updatedStatus,
                submittedAt: item.business.createdAt,
              },
          history: [localHistoryItem, ...item.history],
        };
      }));

      setApproveNote("");
      setRejectNote("");
      setRequestDocsNote("");

      toast.success(`Verification ${formatStatusLabel(action)}.`);
      await loadQueue();
    } catch (error) {
      console.error("Unable to submit verification action", error);
      toast.error("Unable to complete that action.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const isSubmittingPromotionAction = (promotionId: number) => promotionActionId === promotionId;

  const handleApprovePromotion = async (promotion: Promotion) => {
    setPromotionActionId(promotion.id);
    try {
      await api.approvePromotion(promotion.id);
      toast.success(`Promotion "${promotion.title}" was approved and is now live.`);
      await loadPromotions();
    } catch (error) {
      console.error("Unable to approve promotion", error);
      toast.error("Unable to approve that promotion.");
    } finally {
      setPromotionActionId(null);
    }
  };

  const handleRejectPromotion = async (promotion: Promotion) => {
    const reason = moderationReasonByPromotionId[promotion.id]?.trim();
    if (!reason) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    setPromotionActionId(promotion.id);
    try {
      await api.rejectPromotion(promotion.id, reason);
      setModerationReasonByPromotionId((current) => ({ ...current, [promotion.id]: "" }));
      toast.success(`Promotion "${promotion.title}" was rejected.`);
      await loadPromotions();
    } catch (error) {
      console.error("Unable to reject promotion", error);
      toast.error("Unable to reject that promotion.");
    } finally {
      setPromotionActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Admin Operations Console</h1>
          <p className="text-muted-foreground max-w-3xl">
            Search a business and review both verification submissions and promotion moderation items from one place.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Approval filters</CardTitle>
            <CardDescription>
              Search by business name, owner, contact email, promotion title, or location to find the moderation items you need to approve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xl">
              <Label htmlFor="queue-search">Search businesses or promotions</Label>
              <Input
                id="queue-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Business name, owner, email, promotion title, or location"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="business-verification" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="business-verification">Business verification</TabsTrigger>
            <TabsTrigger value="promotion-moderation">Promotion moderation</TabsTrigger>
          </TabsList>

          <TabsContent value="business-verification" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Verification Queue</CardTitle>
                  <CardDescription>
                    Businesses waiting for approval or additional documents.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Queue filter</Label>
                    <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as QueueStatusFilter)}>
                      <TabsList className="grid grid-cols-3">
                        <TabsTrigger value="ALL">All</TabsTrigger>
                        <TabsTrigger value="PENDING">Pending</TabsTrigger>
                        <TabsTrigger value="MORE_DOCUMENTS_REQUESTED">Docs requested</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Business</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Contact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingQueue && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Loading verification queue...
                            </TableCell>
                          </TableRow>
                        )}

                        {!isLoadingQueue && filteredQueueItems.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No businesses match your current filters.
                            </TableCell>
                          </TableRow>
                        )}

                        {!isLoadingQueue && filteredQueueItems.map((item) => {
                          const status = String(item.review?.status ?? item.business.businessVerificationStatus ?? "PENDING").toUpperCase();
                          const isSelected = selectedBusinessId === item.business.id;

                          return (
                            <TableRow
                              key={item.business.id}
                              className={isSelected ? "bg-muted/60 cursor-pointer" : "cursor-pointer"}
                              onClick={() => setSelectedBusinessId(item.business.id)}
                            >
                              <TableCell>
                                <p className="font-medium">{item.business.businessName}</p>
                                <p className="text-xs text-muted-foreground">Owner: {item.business.ownerName}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{formatStatusLabel(status)}</Badge>
                              </TableCell>
                              <TableCell>{formatDateTime(item.review?.submittedAt ?? item.business.createdAt)}</TableCell>
                              <TableCell>{item.business.contactEmail}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Review Details</CardTitle>
                  <CardDescription>
                    Inspect documents and complete one explicit action with reviewer notes.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {!selectedQueueItem && (
                    <p className="text-sm text-muted-foreground">
                      Select a business from the queue to start reviewing.
                    </p>
                  )}

                  {selectedQueueItem && (() => {
                    const supportingDocumentsUrl = getVerificationFieldValue(
                      selectedQueueItem,
                      ["supportingDocumentsUrl", "supporting_documents_url", "documentsUrl", "documents_url", "documentUrl", "document_url", "supportingDocumentUrl"],
                    );

                    return (
                    <>
                      <div className="space-y-1">
                        <h2 className="text-xl font-semibold">{selectedQueueItem.business.businessName}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedQueueItem.business.city}, {selectedQueueItem.business.country} · {selectedQueueItem.business.contactEmail}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">VAT number</p>
                          <p className="font-medium">{formatOptionalValue(getVerificationFieldValue(selectedQueueItem, ["vatNumber", "vat_number", "vatNo", "vat_no", "vat", "vatId", "vat_id", "businessVatNumber", "business_vat_number", "vatRegistrationNumber", "vat_registration_number"]))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">TIN number</p>
                          <p className="font-medium">{formatOptionalValue(getVerificationFieldValue(selectedQueueItem, ["tinNumber", "tin_number", "tinNo", "tin_no", "tin", "taxIdentificationNumber", "tax_identification_number", "taxTinNumber", "tax_tin_number", "taxPayerNumber", "tax_payer_number"]))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Owner national ID</p>
                          <p className="font-medium">{formatOptionalValue(getVerificationFieldValue(selectedQueueItem, ["ownerNationalId", "owner_national_id", "nationalId", "national_id", "ownerIdNumber", "owner_id_number", "nationalIdNumber", "national_id_number", "ownerNationalID", "owner_nationalID", "ownerNationalIdentityNumber", "owner_national_identity_number"]))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Submitted</p>
                          <p className="font-medium">{formatDateTime(selectedQueueItem.review?.submittedAt ?? selectedQueueItem.business.createdAt)}</p>
                        </div>
                      </div>

                      <div className="rounded-md border p-3 bg-muted/25">
                        <p className="text-sm font-medium mb-2">Supporting documents preview</p>
                        {supportingDocumentsUrl ? (
                          <div className="space-y-2">
                            <a
                              href={supportingDocumentsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline break-all text-sm"
                            >
                              {supportingDocumentsUrl}
                            </a>
                            <p className="text-xs text-muted-foreground">
                              Open link in a new tab to inspect uploaded files.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No supporting documents were included.</p>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="approve-note">Approve · optional reviewer note</Label>
                          <Textarea
                            id="approve-note"
                            value={approveNote}
                            onChange={(event) => setApproveNote(event.target.value)}
                            placeholder="Optional: add internal context for this approval."
                            rows={3}
                          />
                          <Button
                            className="w-full"
                            disabled={isSubmittingAction}
                            onClick={() => void runReviewAction("APPROVED", approveNote)}
                          >
                            Approve Business
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reject-note">Reject · reviewer note</Label>
                          <Textarea
                            id="reject-note"
                            value={rejectNote}
                            onChange={(event) => setRejectNote(event.target.value)}
                            placeholder="Describe rejection reason and next steps."
                            rows={3}
                          />
                          <Button
                            variant="destructive"
                            className="w-full"
                            disabled={isSubmittingAction}
                            onClick={() => void runReviewAction("REJECTED", rejectNote)}
                          >
                            Reject Business
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="request-docs-note">Request more documents · reviewer note</Label>
                          <Textarea
                            id="request-docs-note"
                            value={requestDocsNote}
                            onChange={(event) => setRequestDocsNote(event.target.value)}
                            placeholder="List exactly which files are still required."
                            rows={3}
                          />
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={isSubmittingAction}
                            onClick={() => void runReviewAction("MORE_DOCUMENTS_REQUESTED", requestDocsNote)}
                          >
                            Request More Documents
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <h3 className="text-base font-semibold">Reviewer notes history</h3>
                        {selectedQueueItem.history.length === 0 && (
                          <p className="text-sm text-muted-foreground">No reviewer history available yet.</p>
                        )}
                        {selectedQueueItem.history.length > 0 && (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {selectedQueueItem.history.map((entry) => (
                              <div key={entry.id} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <Badge variant="outline">{formatStatusLabel(entry.status)}</Badge>
                                  <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                                </div>
                                <p className="mt-2">{entry.note}</p>
                                <p className="text-xs text-muted-foreground mt-1">By {entry.actor}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="promotion-moderation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Promotion moderation queue</CardTitle>
                <CardDescription>
                  Verified businesses with promotions awaiting approval, plus previously moderated promotions for the same business search.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label>Promotion filter</Label>
                  <Tabs
                    value={promotionStatusFilter}
                    onValueChange={(value) => setPromotionStatusFilter(value as PromotionStatusFilter)}
                  >
                    <TabsList className="grid grid-cols-4">
                      <TabsTrigger value="ALL">All</TabsTrigger>
                      <TabsTrigger value="PENDING">Pending</TabsTrigger>
                      <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                      <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Promotion</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingPromotions && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Loading promotion moderation queue...
                          </TableCell>
                        </TableRow>
                      )}

                      {!isLoadingPromotions && filteredPromotionQueueItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No promotions match your current filters.
                          </TableCell>
                        </TableRow>
                      )}

                      {!isLoadingPromotions && filteredPromotionQueueItems.map(({ promotion, business }) => {
                        const status = getPromotionVerificationStatus(promotion);
                        const reason = moderationReasonByPromotionId[promotion.id] ?? "";

                        return (
                          <TableRow key={promotion.id} className="align-top">
                            <TableCell className="space-y-1">
                              <p className="font-medium">{promotion.title}</p>
                              <p className="text-xs text-muted-foreground">{promotion.categoryName} · {promotion.location}</p>
                              {promotion.verificationNotes && (
                                <p className="text-xs text-muted-foreground">Notes: {promotion.verificationNotes}</p>
                              )}
                            </TableCell>
                            <TableCell className="space-y-1">
                              <p className="font-medium">{business?.businessName ?? promotion.businessName ?? `Business #${promotion.businessId}`}</p>
                              <p className="text-xs text-muted-foreground">{business?.ownerName ?? `Business ID ${promotion.businessId}`}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status === "REJECTED" ? "destructive" : "secondary"}>{formatStatusLabel(status)}</Badge>
                            </TableCell>
                            <TableCell className="space-y-2 min-w-[260px]">
                              <p className="text-sm">{formatDateTime(promotion.createdAt)}</p>
                              {status === "PENDING" && (
                                <div className="space-y-2">
                                  <Textarea
                                    value={reason}
                                    onChange={(event) => setModerationReasonByPromotionId((current) => ({
                                      ...current,
                                      [promotion.id]: event.target.value,
                                    }))}
                                    placeholder="If rejecting, provide the reason shown to the business owner."
                                    rows={3}
                                    disabled={isSubmittingPromotionAction(promotion.id)}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => void handleApprovePromotion(promotion)}
                                      disabled={isSubmittingPromotionAction(promotion.id)}
                                    >
                                      {isSubmittingPromotionAction(promotion.id) ? "Saving..." : "Approve"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => void handleRejectPromotion(promotion)}
                                      disabled={isSubmittingPromotionAction(promotion.id)}
                                    >
                                      {isSubmittingPromotionAction(promotion.id) ? "Saving..." : "Reject"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {status !== "PENDING" && (
                                <p className="text-xs text-muted-foreground">
                                  {promotion.rejectionReason ?? promotion.verificationNotes ?? "Already moderated."}
                                </p>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Legacy operations tools are deprecated. This page is now the dedicated workflow for business verification and promotion moderation.
          <Link to="/dashboard" className="text-primary underline ml-1">Return to dashboard</Link>
        </p>
      </main>
    </div>
  );
};

export default OperationsConsole;

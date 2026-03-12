import { useEffect, useMemo, useState } from "react";
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
import {api, type Business, type BusinessVerificationReview } from "@/lib/api";

type ReviewAction = "APPROVED" | "REJECTED" | "MORE_DOCUMENTS_REQUESTED";

type ReviewerHistoryItem = {
  id: string;
  status: string;
  note: string;
  actor: string;
  createdAt: string;
};

type QueueStatusFilter = "ALL" | "PENDING" | "MORE_DOCUMENTS_REQUESTED";

type QueueItem = {
  business: Business;
  review: BusinessVerificationReview | null;
  history: ReviewerHistoryItem[];
};

const PENDING_STATUSES = new Set(["PENDING", "IN_REVIEW", "SUBMITTED"]);
const REQUESTED_MORE_DOCS_STATUSES = new Set(["MORE_DOCUMENTS_REQUESTED", "ADDITIONAL_DOCUMENTS_REQUIRED"]);

//Helper used to safely inspect unknown response payloads without sacrificing runtime safety
const isRecord = (value: unknown): value is Record <string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formalStatusLabel = (status: string) =>
  status
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatDateTime = (value?: string )=> {
  if (!value) return "-";
  const date = new Date(value);
  return  date.toLocaleString();
};

const extractHistoryFromReview = (review: BusinessVerificationReview | null): ReviewerHistoryItem[] => {
  if (!review) return [];

  const reviewAsRecord = review as unknown as Record<string, unknown>;
  const rawHistory =
    reviewAsRecord.reviewHistory
    ?? reviewAsRecord.reviewerHistory
    ?? reviewAsRecord.notesHistory
    ?? [];
     if (!Array.isArray(rawHistory)) return [];
};

 return rawHistory
 .map((entry, index) => {
  if (!isRecord(entry)) {
    return null;

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



const matchesQueueFilter = (status: string, filter: QueueStatusFilter) => {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return PENDING_STATUSES.has(status);
  return REQUESTED_MORE_DOCS_STATUSES.has(status);
};



const OperationsConsole = () => {
  // Search/filter state for the queue table.
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("PENDING");

  // Selection state: which business is currently being reviewed in the detail panel.
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  // Form state for each explicit admin action.
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [requestDocsNote, setRequestDocsNote] = useState("");

  // Data and UX state (loading + submission locks).
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  /**
   * Pulls admin business queue + review payloads and shapes them for the UI table/detail view.
   */
  const loadQueue = async () => {
    setIsLoadingQueue(true);

    try {
      const businesses = await api.getAdminBusinesses();

      const businessesWithReviews = await Promise.all(
        businesses.map(async (business) => {
          try {
            // We intentionally use the business id because this backend already resolves review by id in other admin flows.
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

      // Keep only businesses that are still in a verification workflow stage.
      const pendingQueue = businessesWithReviews.filter((item) => {
        const normalizedStatus = String(
          item.review?.status ?? item.business.businessVerificationStatus ?? ""
        ).toUpperCase();
        return PENDING_STATUSES.has(normalizedStatus)
          || REQUESTED_MORE_DOCS_STATUSES.has(normalizedStatus);
      });

      setQueueItems(pendingQueue);

      // Auto-select the first row on first load if nothing is currently selected.
      if (pendingQueue.length > 0 && selectedBusinessId === null) {
        setSelectedBusinessId(pendingQueue[0].business.id);
      }
    } catch (error) {
      console.error("Unable to load admin verification queue", error);
      toast.error("Unable to load verification queue.");
    } finally {
      setIsLoadingQueue(false);
    }

  };

  // Initial fetch of admin queue data.
  useEffect(() => {
    void loadQueue();
  }, []);

  const selectedQueueItem = useMemo(
    () => queueItems.find((item) => item.business.id === selectedBusinessId) ?? null,
    [queueItems, selectedBusinessId]
  );

  const filteredQueueItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return queueItems.filter((item) => {
      const normalizedStatus = String(
        item.review?.status ?? item.business.businessVerificationStatus ?? ""
      ).toUpperCase();

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

  /**
   * Shared action runner for approve/reject/request-documents buttons.
   * It executes backend action, updates local reviewer history, and refreshes queue rows.
   */
  const runReviewAction = async (action: ReviewAction, note: string) => {
    if (!selectedQueueItem) {
      toast.error("Select a business before running an action.");
      return;
    }

    if (!note.trim()) {
      toast.error("Please provide a reviewer note.");
      return;
    }

    setIsSubmittingAction(true);

    try {
      if (action === "APPROVED") {
        await api.approveBusinessVerification(selectedQueueItem.business.id, note.trim());
      }

      if (action === "REJECTED") {
        await api.rejectBusinessVerification(selectedQueueItem.business.id, note.trim());
      }

      if (action === "MORE_DOCUMENTS_REQUESTED") {
        await api.requestAdditionalBusinessVerificationDocuments(selectedQueueItem.business.id, note.trim());
      }

      // Append a local timeline entry so the reviewer gets instant feedback before server refresh settles.
      setQueueItems((previous) => previous.map((item) => {
        if (item.business.id !== selectedQueueItem.business.id) {
          return item;
        }

        const updatedStatus = action;
        const localHistoryItem: ReviewerHistoryItem = {
          id: `local-${Date.now()}`,
          status: updatedStatus,
          note: note.trim(),
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
       <main className="container mx-auto px-4 py-10 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Admin Business Verification</h1>
          <p className="text-muted-foreground max-w-3xl">
            Review pending business applications, inspect supporting documents, and take a clear action for each case.
          </p>
        </div>

       <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Verification Queue</CardTitle>
              <CardDescription>
                Filter by status and search for a specific business before opening the review panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="queue-search">Search businesses</Label>
                  <Input
                    id="queue-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Business name, owner, email, or location"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Queue tab</Label>
                  <Tabs
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as QueueStatusFilter)}
                  >
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="ALL">All</TabsTrigger>
                      <TabsTrigger value="PENDING">Pending</TabsTrigger>
                      <TabsTrigger value="MORE_DOCUMENTS_REQUESTED">Docs requested</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
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
                          className={isSelected ? "bg-muted/60" : "cursor-pointer"}
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

              {selectedQueueItem && (
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
                      <p className="font-medium">{selectedQueueItem.review?.vatNumber ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">TIN number</p>
                      <p className="font-medium">{selectedQueueItem.review?.tinNumber ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Owner national ID</p>
                      <p className="font-medium">{selectedQueueItem.review?.ownerNationalId ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Submitted</p>
                      <p className="font-medium">{formatDateTime(selectedQueueItem.review?.submittedAt ?? selectedQueueItem.business.createdAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-md border p-3 bg-muted/25">
                    <p className="text-sm font-medium mb-2">Supporting documents preview</p>
                    {selectedQueueItem.review?.supportingDocumentsUrl ? (
                      <div className="space-y-2">
                        <a
                          href={selectedQueueItem.review.supportingDocumentsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline break-all text-sm"
                        >
                          {selectedQueueItem.review.supportingDocumentsUrl}
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
                      <Label htmlFor="approve-note">Approve · reviewer note</Label>
                      <Textarea
                        id="approve-note"
                        value={approveNote}
                        onChange={(event) => setApproveNote(event.target.value)}
                        placeholder="Explain why this business is approved."
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
              )}
            </CardContent>
          </Card>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Legacy operations tools are deprecated. This page is now the dedicated workflow for business verification.
          <Link to="/dashboard" className="text-primary underline ml-1">Return to dashboard</Link>
        </p>
        
      </main>
    </div>
  );
};

export default OperationsConsole;

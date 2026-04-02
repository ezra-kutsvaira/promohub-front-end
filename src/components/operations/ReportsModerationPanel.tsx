import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type ReportItem, type ReportResolutionAction } from "@/lib/api";

type ReportFilter = "ALL" | "OPEN" | "REVIEWING" | "CLOSED";
type ReportWorkflowStatus = Exclude<ReportFilter, "ALL">;
type PromotionReportSummary = {
  totalReports: number;
  openReports: number;
  reviewingReports: number;
  closedReports: number;
  uniqueReporterCount: number;
};

const REPORT_OPEN_STATUSES = new Set(["OPEN", "PENDING", "SUBMITTED", "NEW"]);
const REPORT_REVIEWING_STATUSES = new Set(["REVIEWING", "IN_REVIEW", "UNDER_REVIEW", "IN_PROGRESS"]);
const REPORT_CLOSED_STATUSES = new Set(["CLOSED", "RESOLVED", "COMPLETED", "DISMISSED"]);
const REPORT_FINAL_ACTIONS = new Set(["DISMISS_REPORT", "KEEP_PROMOTION_FLAGGED", "REJECT_PROMOTION"]);
const DISTINCT_REPORTER_ESCALATION_THRESHOLD = 3;

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

const formatOptionalValue = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  const normalizedValue = String(value).trim();
  return normalizedValue.length > 0 ? normalizedValue : "-";
};

const normalizeStatus = (value?: string | null) =>
  typeof value === "string" ? value.trim().replace(/[-\s]+/g, "_").toUpperCase() : "";

const getReportWorkflowStatus = (report: ReportItem): ReportWorkflowStatus => {
  const normalizedStatus = normalizeStatus(report.status);
  const normalizedResolutionAction = normalizeStatus(report.resolutionAction);

  if (
    report.resolvedAt ||
    REPORT_FINAL_ACTIONS.has(normalizedResolutionAction) ||
    REPORT_CLOSED_STATUSES.has(normalizedStatus)
  ) {
    return "CLOSED";
  }

  if (normalizedResolutionAction === "REVIEWING") {
    return "REVIEWING";
  }

  if (report.reviewStartedAt || REPORT_REVIEWING_STATUSES.has(normalizedStatus)) {
    return "REVIEWING";
  }

  if (REPORT_OPEN_STATUSES.has(normalizedStatus)) {
    return "OPEN";
  }

  return "OPEN";
};

const getAdminVisibilityMessage = (report: ReportItem) => {
  const workflowStatus = getReportWorkflowStatus(report);
  const resolutionAction = normalizeStatus(report.resolutionAction);

  if (workflowStatus === "OPEN") {
    return "Admins see this in the Open queue until someone starts investigating it.";
  }

  if (workflowStatus === "REVIEWING") {
    return "Admins see this in the Reviewing tab so the team knows the investigation is already in progress.";
  }

  if (resolutionAction === "KEEP_PROMOTION_FLAGGED") {
    return "The report is closed, but the promotion stays flagged and should still show as flagged in moderation queues.";
  }

  if (resolutionAction === "REJECT_PROMOTION") {
    return "The report is closed and the promotion moves into the rejected moderation state for admins.";
  }

  if (resolutionAction === "DISMISS_REPORT") {
    return "The report is closed without enforcement, so admins keep only the audit trail.";
  }

  return "This report is closed and recorded for moderation history.";
};

const getBusinessOwnerVisibilityMessage = (report: ReportItem) => {
  const workflowStatus = getReportWorkflowStatus(report);
  const resolutionAction = normalizeStatus(report.resolutionAction);

  if (workflowStatus === "OPEN") {
    return report.promotionFlagged
      ? "The business owner can see the promotion is flagged, but there is no final outcome yet."
      : "The business owner does not see a final moderation decision yet.";
  }

  if (workflowStatus === "REVIEWING") {
    return report.promotionFlagged
      ? "The business owner can see the promotion is still flagged while admins continue reviewing it."
      : "The business owner still has no final moderation outcome yet while review is in progress.";
  }

  if (resolutionAction === "KEEP_PROMOTION_FLAGGED") {
    return "The business owner keeps seeing the promotion as flagged even though this report itself is closed.";
  }

  if (resolutionAction === "REJECT_PROMOTION") {
    return "The business owner sees the promotion move to Rejected together with the rejection reason entered below.";
  }

  if (resolutionAction === "DISMISS_REPORT") {
    return "The business owner keeps the promotion at its current status because the report was closed without enforcement.";
  }

  return "The business owner sees the promotion's current moderation state in their dashboard.";
};

const matchesSearch = (report: ReportItem, normalizedSearch: string) => {
  if (!normalizedSearch) return true;

  const searchableText = [
    report.reason,
    report.details,
    report.promotionTitle,
    report.businessName,
    report.reporterName,
    report.status,
    report.promotionStatus,
    report.resolutionNotes,
    report.adminReviewerName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
};

const resolutionActionLabels: Record<ReportResolutionAction, string> = {
  DISMISS_REPORT: "Dismissed",
  KEEP_PROMOTION_FLAGGED: "Kept flagged",
  REJECT_PROMOTION: "Promotion rejected",
};

const getReporterKey = (report: ReportItem) => {
  if (typeof report.reporterId === "number" && Number.isFinite(report.reporterId)) {
    return `id:${report.reporterId}`;
  }

  const normalizedReporterName = report.reporterName?.trim().toLowerCase();
  if (normalizedReporterName) {
    return `name:${normalizedReporterName}`;
  }

  return null;
};

const getEscalationRecommendation = (
  summary: PromotionReportSummary | null,
  report: ReportItem,
) => {
  if (!summary) {
    return "This is the only visible report for this promotion right now, so an admin can keep reviewing before deciding whether to flag or take it down.";
  }

  if (summary.uniqueReporterCount >= DISTINCT_REPORTER_ESCALATION_THRESHOLD) {
    return `This promotion has been reported by ${summary.uniqueReporterCount} different users. Recommended action: take the promotion down and reject it until the business owner fixes and re-submits it.`;
  }

  if (report.promotionFlagged || summary.reviewingReports > 0) {
    return "Recommended action: keep the promotion flagged while the admin team keeps monitoring it. Close only the individual report when the investigation note is complete.";
  }

  return "Recommended action: keep reviewing unless the report proves the promotion is misleading, invalid, fraudulent, or repeatedly disputed by different users.";
};

export const ReportsModerationPanel = ({ searchTerm }: { searchTerm: string }) => {
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportFilter>("OPEN");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [promotionRejectionReason, setPromotionRejectionReason] = useState("");
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reportActionId, setReportActionId] = useState<number | null>(null);

  const loadReports = useCallback(async () => {
    setIsLoadingReports(true);

    try {
      const queue = await api.getReports({ size: 200 });
      setReports(queue);
      setSelectedReportId((current) => {
        if (queue.length === 0) return null;
        if (current !== null && queue.some((item) => item.id === current)) {
          return current;
        }
        return queue[0].id;
      });
    } catch (error) {
      console.error("Unable to load reports queue", error);
      toast.error("Unable to load reports queue.");
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      if (reportStatusFilter !== "ALL" && getReportWorkflowStatus(report) !== reportStatusFilter) {
        return false;
      }

      return matchesSearch(report, normalizedSearch);
    });
  }, [reportStatusFilter, reports, searchTerm]);

  useEffect(() => {
    setSelectedReportId((current) => {
      if (filteredReports.length === 0) {
        return null;
      }

      if (current !== null && filteredReports.some((report) => report.id === current)) {
        return current;
      }

      return filteredReports[0].id;
    });
  }, [filteredReports]);

  const selectedReport = useMemo(
    () => filteredReports.find((report) => report.id === selectedReportId) ?? null,
    [filteredReports, selectedReportId],
  );

  const promotionReportSummaryByPromotionId = useMemo(() => {
    const summaryByPromotionId = new Map<number, PromotionReportSummary & { reporterKeys: Set<string> }>();

    reports.forEach((report) => {
      if (typeof report.promotionId !== "number" || !Number.isFinite(report.promotionId)) {
        return;
      }

      const currentSummary = summaryByPromotionId.get(report.promotionId) ?? {
        totalReports: 0,
        openReports: 0,
        reviewingReports: 0,
        closedReports: 0,
        uniqueReporterCount: 0,
        reporterKeys: new Set<string>(),
      };

      currentSummary.totalReports += 1;

      const workflowStatus = getReportWorkflowStatus(report);
      if (workflowStatus === "OPEN") currentSummary.openReports += 1;
      if (workflowStatus === "REVIEWING") currentSummary.reviewingReports += 1;
      if (workflowStatus === "CLOSED") currentSummary.closedReports += 1;

      const reporterKey = getReporterKey(report);
      if (reporterKey) {
        currentSummary.reporterKeys.add(reporterKey);
      }

      currentSummary.uniqueReporterCount = currentSummary.reporterKeys.size;
      summaryByPromotionId.set(report.promotionId, currentSummary);
    });

    return new Map<number, PromotionReportSummary>(
      Array.from(summaryByPromotionId.entries()).map(([promotionId, summary]) => [
        promotionId,
        {
          totalReports: summary.totalReports,
          openReports: summary.openReports,
          reviewingReports: summary.reviewingReports,
          closedReports: summary.closedReports,
          uniqueReporterCount: summary.uniqueReporterCount,
        },
      ]),
    );
  }, [reports]);

  const selectedPromotionReportSummary = useMemo(
    () => (
      selectedReport?.promotionId
        ? promotionReportSummaryByPromotionId.get(selectedReport.promotionId) ?? null
        : null
    ),
    [promotionReportSummaryByPromotionId, selectedReport?.promotionId],
  );

  useEffect(() => {
    setResolutionNote(selectedReport?.resolutionNotes ?? "");
    setPromotionRejectionReason("");
  }, [selectedReport?.id, selectedReport?.resolutionNotes]);

  const isSubmittingAction = (reportId: number) => reportActionId === reportId;

  const runAction = async (action: "REVIEWING" | ReportResolutionAction) => {
    if (!selectedReport) {
      toast.error("Select a report before taking an action.");
      return;
    }

    const normalizedResolutionNote = resolutionNote.trim();
    const normalizedRejectionReason = promotionRejectionReason.trim();

    if (action !== "REVIEWING" && !normalizedResolutionNote) {
      toast.error("Add a reviewer note before closing this report.");
      return;
    }

    if (action === "REJECT_PROMOTION" && !normalizedRejectionReason) {
      toast.error("Provide the reason that should be shown to the business owner.");
      return;
    }

    setReportActionId(selectedReport.id);

    try {
      if (action === "REVIEWING") {
        const updatedReport = await api.markReportReviewing(selectedReport.id);
        const optimisticReviewStartedAt = updatedReport.reviewStartedAt ?? selectedReport.reviewStartedAt ?? new Date().toISOString();
        const normalizedReturnedAction = normalizeStatus(updatedReport.resolutionAction);
        const nextReport: ReportItem = {
          ...selectedReport,
          ...updatedReport,
          status: updatedReport.status?.trim() ? updatedReport.status : "REVIEWING",
          reviewStartedAt: optimisticReviewStartedAt,
          resolvedAt: undefined,
          resolutionAction: normalizedReturnedAction === "REVIEWING" ? undefined : updatedReport.resolutionAction,
        };

        setReports((current) => current.map((report) => (
          report.id === selectedReport.id ? nextReport : report
        )));
        setReportStatusFilter("REVIEWING");
        setSelectedReportId(nextReport.id);
        toast.success("Report moved to reviewing.");
      } else {
        const updatedReport = await api.resolveReport(selectedReport.id, {
          action,
          resolution: normalizedResolutionNote,
          promotionRejectionReason: normalizedRejectionReason || undefined,
        });

        toast.success(
          action === "REJECT_PROMOTION"
            ? "Report closed and promotion rejected."
            : action === "KEEP_PROMOTION_FLAGGED"
              ? "Report closed and promotion kept flagged."
              : "Report dismissed and closed."
        );

        setReports((current) => current.map((report) => (
          report.id === updatedReport.id ? updatedReport : report
        )));
      }

      if (action !== "REVIEWING") {
        await loadReports();
      }
    } catch (error) {
      console.error("Unable to update report", error);
      const message = error instanceof Error ? error.message : "Unable to complete that report action.";
      toast.error(message);
    } finally {
      setReportActionId(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Reports queue</CardTitle>
          <CardDescription>
            Review suspicious promotion reports, triage them, and decide whether each promotion should stay live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Report filter</Label>
            <Tabs value={reportStatusFilter} onValueChange={(value) => setReportStatusFilter(value as ReportFilter)}>
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="ALL">All</TabsTrigger>
                <TabsTrigger value="OPEN">Open</TabsTrigger>
                <TabsTrigger value="REVIEWING">Reviewing</TabsTrigger>
                <TabsTrigger value="CLOSED">Closed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingReports && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Loading reports queue...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoadingReports && filteredReports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No reports match your current filters.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoadingReports && filteredReports.map((report) => {
                  const isSelected = selectedReportId === report.id;
                  const workflowStatus = getReportWorkflowStatus(report);

                  return (
                    <TableRow
                      key={report.id}
                      className={isSelected ? "bg-muted/60 cursor-pointer" : "cursor-pointer"}
                      onClick={() => setSelectedReportId(report.id)}
                    >
                      <TableCell className="space-y-1">
                        <p className="font-medium">{formatStatusLabel(report.reason)}</p>
                        <p className="text-xs text-muted-foreground">
                          Reporter: {formatOptionalValue(report.reporterName)}
                        </p>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <p className="font-medium">
                          {report.promotionTitle ?? `Promotion #${formatOptionalValue(report.promotionId)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {report.businessName ?? "Unknown business"}
                        </p>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <Badge variant={workflowStatus === "CLOSED" ? "outline" : "secondary"}>
                          {formatStatusLabel(workflowStatus)}
                        </Badge>
                        {report.promotionFlagged && (
                          <Badge variant="destructive">Flagged</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(report.createdAt)}</TableCell>
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
          <CardTitle>Report details</CardTitle>
          <CardDescription>
            Inspect the report, review the promotion risk indicators, and record your moderation decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!selectedReport && (
            <p className="text-sm text-muted-foreground">
              Select a report from the queue to start reviewing it.
            </p>
          )}

          {selectedReport && (
            <>
              {(() => {
                const workflowStatus = getReportWorkflowStatus(selectedReport);
                const rawStatus = normalizeStatus(selectedReport.status);
                const showBackendStatus = rawStatus.length > 0 && rawStatus !== workflowStatus;

                return (
                  <>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={workflowStatus === "CLOSED" ? "outline" : "secondary"}>
                    {formatStatusLabel(workflowStatus)}
                  </Badge>
                  {selectedReport.promotionStatus && (
                    <Badge variant={selectedReport.promotionStatus === "REJECTED" ? "destructive" : "outline"}>
                      Promotion {formatStatusLabel(selectedReport.promotionStatus)}
                    </Badge>
                  )}
                  {selectedReport.promotionFlagged && (
                    <Badge variant="destructive">Flagged</Badge>
                  )}
                </div>
                <h2 className="text-xl font-semibold">
                  {selectedReport.promotionTitle ?? `Promotion #${selectedReport.promotionId}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedReport.businessName ?? "Unknown business"}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Workflow status</p>
                  <p className="font-medium">{formatStatusLabel(workflowStatus)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Backend status</p>
                  <p className="font-medium">
                    {showBackendStatus ? formatStatusLabel(rawStatus) : "Matches workflow status"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Report reason</p>
                  <p className="font-medium">{formatStatusLabel(selectedReport.reason)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reporter</p>
                  <p className="font-medium">{formatOptionalValue(selectedReport.reporterName)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium">{formatDateTime(selectedReport.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Review started</p>
                  <p className="font-medium">{formatDateTime(selectedReport.reviewStartedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Risk score</p>
                  <p className="font-medium">{formatOptionalValue(selectedReport.promotionRiskScore)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reviewer</p>
                  <p className="font-medium">{formatOptionalValue(selectedReport.adminReviewerName)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-4 bg-muted/25 space-y-1">
                  <p className="text-sm font-medium">Admin visibility</p>
                  <p className="text-sm text-muted-foreground">{getAdminVisibilityMessage(selectedReport)}</p>
                </div>
                <div className="rounded-md border p-4 bg-muted/25 space-y-1">
                  <p className="text-sm font-medium">Business owner visibility</p>
                  <p className="text-sm text-muted-foreground">{getBusinessOwnerVisibilityMessage(selectedReport)}</p>
                </div>
              </div>

              {selectedPromotionReportSummary && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border p-4 bg-muted/25 space-y-1">
                    <p className="text-sm font-medium">Total reports</p>
                    <p className="text-2xl font-semibold">{selectedPromotionReportSummary.totalReports}</p>
                  </div>
                  <div className="rounded-md border p-4 bg-muted/25 space-y-1">
                    <p className="text-sm font-medium">Different reporters</p>
                    <p className="text-2xl font-semibold">{selectedPromotionReportSummary.uniqueReporterCount}</p>
                  </div>
                  <div className="rounded-md border p-4 bg-muted/25 space-y-1">
                    <p className="text-sm font-medium">Still open</p>
                    <p className="text-2xl font-semibold">{selectedPromotionReportSummary.openReports + selectedPromotionReportSummary.reviewingReports}</p>
                  </div>
                  <div className="rounded-md border p-4 bg-muted/25 space-y-1">
                    <p className="text-sm font-medium">Escalation rule</p>
                    <p className="text-sm text-muted-foreground">
                      Take down after {DISTINCT_REPORTER_ESCALATION_THRESHOLD} different reporters.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-md border p-4 bg-muted/25 space-y-2">
                <p className="text-sm font-medium">Recommended moderation path</p>
                <p className="text-sm text-muted-foreground">
                  {getEscalationRecommendation(selectedPromotionReportSummary, selectedReport)}
                </p>
              </div>

              <div className="rounded-md border p-4 bg-muted/25 space-y-2">
                <p className="text-sm font-medium">Reporter details</p>
                <p className="text-sm text-muted-foreground">
                  {selectedReport.details?.trim() ? selectedReport.details : "No additional details were provided."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedReport.promotionId && (
                  <Button variant="outline" asChild>
                    <Link to={`/promotion/${selectedReport.promotionId}`}>Open promotion</Link>
                  </Button>
                )}
                <Button variant="ghost" onClick={() => void loadReports()}>
                  Refresh queue
                </Button>
              </div>

              <Separator />

              {workflowStatus === "CLOSED" ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Resolution outcome</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedReport.resolutionAction
                        ? resolutionActionLabels[selectedReport.resolutionAction as ReportResolutionAction] ?? formatStatusLabel(selectedReport.resolutionAction)
                        : "Closed"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Resolution notes</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedReport.resolutionNotes?.trim() ? selectedReport.resolutionNotes : "No resolution notes recorded."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Resolved at</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(selectedReport.resolvedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border p-4 bg-muted/25 space-y-2">
                    <p className="text-sm font-medium">What each action means</p>
                    <p className="text-sm text-muted-foreground">
                      Mark reviewing moves the report into the Reviewing tab so other admins know the case is already being worked on.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Dismiss and close records that the report was reviewed but does not change the promotion status for the business owner because the claim was not strong enough.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Keep flagged and close closes this one report, but the promotion stays flagged, remains visible to admins, and still signals follow-up risk to the business owner.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reject promotion and close report takes the promotion down. Use it when the promotion is misleading, invalid, fraudulent, policy-breaking, or has repeated complaints from different users.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="report-resolution-note">Reviewer notes</Label>
                    <Textarea
                      id="report-resolution-note"
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      placeholder="Record what you reviewed and why you are taking this action."
                      rows={4}
                      disabled={isSubmittingAction(selectedReport.id)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {workflowStatus !== "REVIEWING" && (
                      <Button
                        variant="outline"
                        onClick={() => void runAction("REVIEWING")}
                        disabled={isSubmittingAction(selectedReport.id)}
                      >
                        {isSubmittingAction(selectedReport.id) ? "Saving..." : "Mark reviewing"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => void runAction("DISMISS_REPORT")}
                      disabled={isSubmittingAction(selectedReport.id)}
                    >
                      {isSubmittingAction(selectedReport.id) ? "Saving..." : "Dismiss & close"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void runAction("KEEP_PROMOTION_FLAGGED")}
                      disabled={isSubmittingAction(selectedReport.id)}
                    >
                      {isSubmittingAction(selectedReport.id) ? "Saving..." : "Keep flagged & close"}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="report-rejection-reason">Promotion rejection reason</Label>
                    <Textarea
                      id="report-rejection-reason"
                      value={promotionRejectionReason}
                      onChange={(event) => setPromotionRejectionReason(event.target.value)}
                      placeholder="Explain to the business owner why the promotion was taken down and what must be fixed before re-submitting."
                      rows={3}
                      disabled={isSubmittingAction(selectedReport.id)}
                    />
                  </div>

                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => void runAction("REJECT_PROMOTION")}
                    disabled={isSubmittingAction(selectedReport.id)}
                  >
                    {isSubmittingAction(selectedReport.id) ? "Saving..." : "Reject promotion, take down & close report"}
                  </Button>
                </div>
              )}
                  </>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsModerationPanel;

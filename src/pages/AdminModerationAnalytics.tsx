import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";
import AnalyticsMetricCard from "@/components/analytics/AnalyticsMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
  api,
  type AdminModerationSummary,
  type PlatformAnalytics,
  type Promotion,
  type ReportItem,
} from "@/lib/api";
import { getPromotionVerificationStatus } from "@/lib/promotionStatus";

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");
const ACTIONS_CHART_CONFIG = {
  count: { label: "Events", color: "#0f766e" },
};
const QUEUE_CHART_CONFIG = {
  count: { label: "Items", color: "#d97706" },
};

const formatCount = (value: number) => NUMBER_FORMATTER.format(value);
const formatPercent = (value?: number) => `${(typeof value === "number" && Number.isFinite(value) ? value : 0).toFixed(1)}%`;
const formatStatusLabel = (value?: string) =>
  String(value ?? "UNKNOWN")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
const isWithinDays = (value: string | undefined, days: number) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - days);
  return date >= threshold;
};

const AdminModerationAnalyticsPage = () => {
  const { user } = useAuth();
  const [timeWindowDays, setTimeWindowDays] = useState("30");
  const [summary, setSummary] = useState<AdminModerationSummary | null>(null);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      setIsLoading(true);

      try {
        const [summaryResponse, platformResponse, reportsResponse, promotionsResponse] = await Promise.all([
          api.getAdminModerationSummary(Number(timeWindowDays)),
          api.getPlatformAnalytics(),
          api.getReports({ size: 100 }),
          api.getAdminPromotions(),
        ]);
        if (!isMounted) return;

        setSummary(summaryResponse);
        setPlatformAnalytics(platformResponse);
        setReports(reportsResponse);
        setPromotions(promotionsResponse);
      } catch (error) {
        if (!isMounted) return;

        const message = error instanceof Error ? error.message : "Unable to load moderation analytics.";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [timeWindowDays]);

  const moderationActionData = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      { label: "Created", count: summary.reportsCreated },
      { label: "Reviewing", count: summary.reviewsStarted },
      { label: "Closed", count: summary.reportsClosed },
      { label: "Dismissed", count: summary.reportsDismissed },
      { label: "Flagged", count: summary.promotionsFlagged },
      { label: "Approved", count: summary.promotionsApproved },
      { label: "Rejected", count: summary.promotionsRejected },
      { label: "Resubmitted", count: summary.promotionsResubmitted },
    ];
  }, [summary]);

  const queueStateData = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      { label: "Open reports", count: summary.currentOpenReports },
      { label: "Reviewing", count: summary.currentReviewingReports },
      { label: "Closed", count: summary.currentClosedReports },
      { label: "Flagged promos", count: summary.currentFlaggedPromotions },
      { label: "Rejected promos", count: summary.currentRejectedPromotions },
    ];
  }, [summary]);

  const filteredReports = useMemo(() => {
    return reports
      .filter((report) => {
        const dateCandidate = report.resolvedAt ?? report.reviewStartedAt ?? report.createdAt;
        return isWithinDays(dateCandidate, Number(timeWindowDays));
      })
      .sort((left, right) => {
        const leftTime = new Date(left.createdAt ?? left.reviewStartedAt ?? 0).getTime();
        const rightTime = new Date(right.createdAt ?? right.reviewStartedAt ?? 0).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 12);
  }, [reports, timeWindowDays]);

  const followUpPromotions = useMemo(() => {
    return promotions
      .filter((promotion) => promotion.flagged || getPromotionVerificationStatus(promotion) === "REJECTED")
      .sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 12);
  }, [promotions]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto space-y-8 px-4 py-10">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold md:text-4xl">Moderation analytics</h1>
              <Badge variant="outline">Admin view</Badge>
            </div>
            <p className="max-w-3xl text-muted-foreground">
              Measure report flow, admin actions, queue pressure, and flagged promotion follow-up across the platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeWindowDays} onValueChange={setTimeWindowDays}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <Link to="/operations-console">Operations console</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </section>

        {isLoading ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={`moderation-skeleton-${index}`} className="h-32" />
              ))}
            </section>
            <section className="grid gap-6 xl:grid-cols-2">
              <Skeleton className="h-[420px]" />
              <Skeleton className="h-[420px]" />
            </section>
          </>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AnalyticsMetricCard
                label="Moderation events"
                value={formatCount(summary?.totalModerationEvents ?? 0)}
                description={`${formatCount(summary?.reportsCreated ?? 0)} new reports in the current window`}
              />
              <AnalyticsMetricCard
                label="Reports closed"
                value={formatCount(summary?.reportsClosed ?? 0)}
                description={`${formatPercent(summary?.closureRate)} closure rate`}
              />
              <AnalyticsMetricCard
                label="Reports dismissed"
                value={formatCount(summary?.reportsDismissed ?? 0)}
                description={`${formatCount(summary?.reviewsStarted ?? 0)} reviews started`}
              />
              <AnalyticsMetricCard
                label="Promotions flagged"
                value={formatCount(summary?.promotionsFlagged ?? 0)}
                description={`${formatCount(summary?.promotionsUnflagged ?? 0)} unflagged later`}
              />
              <AnalyticsMetricCard
                label="Promotions rejected"
                value={formatCount(summary?.promotionsRejected ?? 0)}
                description={`${formatPercent(summary?.rejectionRateAfterReport)} rejected after report review`}
              />
              <AnalyticsMetricCard
                label="Queue right now"
                value={formatCount(summary?.currentOpenReports ?? 0)}
                description={`${formatCount(summary?.currentReviewingReports ?? 0)} reports currently under review`}
              />
              <AnalyticsMetricCard
                label="Platform reports"
                value={formatCount(platformAnalytics?.totalReports ?? 0)}
                description={`${formatCount(platformAnalytics?.resolvedReports ?? 0)} resolved in total`}
              />
              <AnalyticsMetricCard
                label="Flagged promotions now"
                value={formatCount(summary?.currentFlaggedPromotions ?? 0)}
                description={`${formatCount(platformAnalytics?.flaggedPromotions ?? 0)} flagged across platform analytics`}
              />
            </section>
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Moderation actions</CardTitle>
                  <CardDescription>
                    Reports and admin actions recorded over the last {timeWindowDays} days.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {moderationActionData.length > 0 ? (
                    <ChartContainer className="h-[320px] w-full aspect-auto" config={ACTIONS_CHART_CONFIG}>
                      <BarChart data={moderationActionData} margin={{ left: 12, right: 12, top: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={64}
                        />
                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                      No moderation events have been recorded in this window.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Live queue state</CardTitle>
                  <CardDescription>Open cases, review workload, and flagged promotion stock.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {queueStateData.length > 0 ? (
                    <ChartContainer className="h-[240px] w-full aspect-auto" config={QUEUE_CHART_CONFIG}>
                      <BarChart data={queueStateData} margin={{ left: 12, right: 12, top: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={48} />
                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                      Queue data will appear as report and moderation events are captured.
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">Current open reports</p>
                      <p className="text-2xl font-semibold">{formatCount(summary?.currentOpenReports ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">Current reviewing reports</p>
                      <p className="text-2xl font-semibold">{formatCount(summary?.currentReviewingReports ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">Current flagged promotions</p>
                      <p className="text-2xl font-semibold">{formatCount(summary?.currentFlaggedPromotions ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">Current rejected promotions</p>
                      <p className="text-2xl font-semibold">{formatCount(summary?.currentRejectedPromotions ?? 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Recent report drill-down</CardTitle>
                  <CardDescription>
                    The most recent report records inside the current window, ready for follow-up in operations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {filteredReports.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Report</TableHead>
                          <TableHead>Promotion</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Next step</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">#{report.id}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{report.promotionTitle ?? `Promotion #${report.promotionId ?? "-"}`}</p>
                                <p className="text-sm text-muted-foreground">{report.businessName ?? "Unknown business"}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{formatStatusLabel(report.status)}</Badge>
                            </TableCell>
                            <TableCell>{formatStatusLabel(report.resolutionAction ?? "Pending")}</TableCell>
                            <TableCell>{formatDateTime(report.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" asChild>
                                <Link to="/operations-console">Open queue</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                      No reports fell inside this time window.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Promotion follow-up table</CardTitle>
                  <CardDescription>
                    Promotions that are still flagged or have already been rejected after moderation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {followUpPromotions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Promotion</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Business</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Open</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {followUpPromotions.map((promotion) => (
                          <TableRow key={promotion.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{promotion.title}</p>
                                <div className="flex flex-wrap gap-2">
                                  {promotion.flagged ? <Badge variant="destructive">Flagged</Badge> : null}
                                  {promotion.categoryName ? <Badge variant="secondary">{promotion.categoryName}</Badge> : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatStatusLabel(getPromotionVerificationStatus(promotion))}</TableCell>
                            <TableCell>{promotion.businessName || `Business #${promotion.businessId}`}</TableCell>
                            <TableCell>{promotion.riskScore ?? "-"}</TableCell>
                            <TableCell>{formatDateTime(promotion.updatedAt || promotion.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" asChild>
                                <Link to={`/promotion/${promotion.id}`}>Open</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                      No flagged or rejected promotions need follow-up right now.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminModerationAnalyticsPage;

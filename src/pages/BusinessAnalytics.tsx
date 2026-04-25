import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";
import AnalyticsMetricCard from "@/components/analytics/AnalyticsMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
  api,
  type Business,
  type BusinessAnalytics,
  type CategoryPerformance,
  type DailyTrend,
  type Promotion,
  type PromotionFunnel,
  type PromotionPerformance,
} from "@/lib/api";
import { getPromotionVerificationStatus } from "@/lib/promotionStatus";

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");
const TREND_CHART_CONFIG = {
  views: { label: "Views", color: "#0f766e" },
  clicks: { label: "Clicks", color: "#d97706" },
  redemptions: { label: "Redemptions", color: "#dc2626" },
};
const CATEGORY_CHART_CONFIG = {
  views: { label: "Views", color: "#0891b2" },
  redemptions: { label: "Redemptions", color: "#16a34a" },
};
const FUNNEL_CHART_CONFIG = {
  count: { label: "Users", color: "#0f766e" },
};
const FUNNEL_BAR_COLORS = ["#0f766e", "#d97706", "#dc2626"];

const formatCount = (value: number) => NUMBER_FORMATTER.format(value);
const formatPercent = (value?: number) => `${(typeof value === "number" && Number.isFinite(value) ? value : 0).toFixed(1)}%`;
const formatStatusLabel = (value?: string) =>
  String(value ?? "UNKNOWN")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
const formatChartDate = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(date);
};
const buildFallbackPerformance = (promotion: Promotion): PromotionPerformance => ({
  promotionId: promotion.id,
  promotionTitle: promotion.title,
  promotionStatus: getPromotionVerificationStatus(promotion),
  flagged: promotion.flagged,
  views: 0,
  clicks: 0,
  redemptions: 0,
  clickThroughRate: 0,
  conversionRate: 0,
});
const buildFallbackFunnel = (performance: PromotionPerformance | null, promotionId: number): PromotionFunnel => {
  const views = performance?.views ?? 0;
  const clicks = performance?.clicks ?? 0;
  const redemptions = performance?.redemptions ?? 0;
  const viewToClickRate = views > 0 ? (clicks / views) * 100 : 0;
  const clickToRedeemRate = clicks > 0 ? (redemptions / clicks) * 100 : 0;
  const viewToRedeemRate = views > 0 ? (redemptions / views) * 100 : 0;

  return {
    promotionId,
    views,
    clicks,
    redemptions,
    viewToClickRate,
    clickToRedeemRate,
    viewToRedeemRate,
    clickDropOffRate: 100 - viewToClickRate,
    redeemDropOffRate: 100 - clickToRedeemRate,
  };
};

const BusinessAnalyticsPage = () => {
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessAnalytics, setBusinessAnalytics] = useState<BusinessAnalytics | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionPerformance, setPromotionPerformance] = useState<Record<number, PromotionPerformance>>({});
  const [selectedPromotionId, setSelectedPromotionId] = useState<number | null>(null);
  const [selectedPromotionPerformance, setSelectedPromotionPerformance] = useState<PromotionPerformance | null>(null);
  const [selectedPromotionFunnel, setSelectedPromotionFunnel] = useState<PromotionFunnel | null>(null);
  const [selectedPromotionTrends, setSelectedPromotionTrends] = useState<DailyTrend[]>([]);
  const [categoryPerformance, setCategoryPerformance] = useState<CategoryPerformance[]>([]);
  const [timeWindowDays, setTimeWindowDays] = useState("30");
  const [businessSetupRequired, setBusinessSetupRequired] = useState(false);
  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingSelectedPromotion, setIsLoadingSelectedPromotion] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadBaseAnalytics = async () => {
      setIsLoadingBase(true);

      try {
        const currentBusiness = await api.getCurrentUserBusiness(user.id);
        if (!isMounted) return;

        setBusiness(currentBusiness);
        setBusinessSetupRequired(false);

        const [analyticsResponse, promotionResponse] = await Promise.all([
          api.getBusinessAnalytics(currentBusiness.id),
          api.getCurrentUserBusinessPromotions(currentBusiness.id, user.id),
        ]);
        if (!isMounted) return;

        setBusinessAnalytics(analyticsResponse);
        setPromotions(promotionResponse);

        const nextSelectedPromotionId =
          selectedPromotionId && promotionResponse.some((promotion) => promotion.id === selectedPromotionId)
            ? selectedPromotionId
            : promotionResponse[0]?.id ?? null;

        setSelectedPromotionId(nextSelectedPromotionId);

        if (promotionResponse.length === 0) {
          setPromotionPerformance({});
          return;
        }

        const performancePairs = await Promise.all(
          promotionResponse.map(async (promotion) => {
            try {
              const performance = await api.getPromotionPerformance(promotion.id);
              return [promotion.id, performance] as const;
            } catch {
              return [promotion.id, buildFallbackPerformance(promotion)] as const;
            }
          })
        );
        if (!isMounted) return;

        const nextPerformance: Record<number, PromotionPerformance> = {};
        performancePairs.forEach(([promotionId, performance]) => {
          nextPerformance[promotionId] = performance;
        });
        setPromotionPerformance(nextPerformance);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const missingBusinessProfile =
          message.includes("no business profile") ||
          message.includes("no business") ||
          message.includes("not found") ||
          message.includes("404");

        if (missingBusinessProfile) {
          if (!isMounted) return;

          setBusinessSetupRequired(true);
          setBusiness(null);
          setBusinessAnalytics(null);
          setPromotions([]);
          setPromotionPerformance({});
          setSelectedPromotionId(null);
          return;
        }

        const errorMessage = error instanceof Error ? error.message : "Unable to load business analytics.";
        toast.error(errorMessage);
      } finally {
        if (isMounted) {
          setIsLoadingBase(false);
        }
      }
    };

    void loadBaseAnalytics();

    return () => {
      isMounted = false;
    };
  }, [user.id]);

  useEffect(() => {
    if (!business) {
      setCategoryPerformance([]);
      return;
    }

    let isMounted = true;

    const loadCategoryPerformance = async () => {
      setIsLoadingCategories(true);

      try {
        const response = await api.getBusinessCategoryPerformance(business.id, Number(timeWindowDays));
        if (isMounted) {
          setCategoryPerformance(response);
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Unable to load category performance.";
          toast.error(message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    };

    void loadCategoryPerformance();

    return () => {
      isMounted = false;
    };
  }, [business, timeWindowDays]);

  useEffect(() => {
    if (!selectedPromotionId) {
      setSelectedPromotionPerformance(null);
      setSelectedPromotionFunnel(null);
      setSelectedPromotionTrends([]);
      return;
    }

    let isMounted = true;

    const loadSelectedPromotion = async () => {
      setIsLoadingSelectedPromotion(true);

      try {
        const [performanceResponse, funnelResponse, trendsResponse] = await Promise.all([
          api.getPromotionPerformance(selectedPromotionId).catch(() => {
            const fallbackPromotion = promotions.find((promotion) => promotion.id === selectedPromotionId);
            return fallbackPromotion ? buildFallbackPerformance(fallbackPromotion) : null;
          }),
          api.getPromotionFunnel(selectedPromotionId).catch(() => null),
          api.getPromotionDailyTrends(selectedPromotionId, Number(timeWindowDays)).catch(() => []),
        ]);
        if (!isMounted) return;

        setSelectedPromotionPerformance(performanceResponse ?? null);
        setSelectedPromotionFunnel(
          funnelResponse ?? buildFallbackFunnel(performanceResponse ?? null, selectedPromotionId)
        );
        setSelectedPromotionTrends(trendsResponse);

        if (performanceResponse) {
          setPromotionPerformance((current) => ({
            ...current,
            [selectedPromotionId]: performanceResponse,
          }));
        }
      } catch (error) {
        if (!isMounted) return;

        const message = error instanceof Error ? error.message : "Unable to load promotion drill-down.";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoadingSelectedPromotion(false);
        }
      }
    };

    void loadSelectedPromotion();

    return () => {
      isMounted = false;
    };
  }, [promotions, selectedPromotionId, timeWindowDays]);

  const selectedPromotion = useMemo(
    () => promotions.find((promotion) => promotion.id === selectedPromotionId) ?? null,
    [promotions, selectedPromotionId]
  );

  const promotionRows = useMemo(() => {
    return promotions
      .map((promotion) => ({
        promotion,
        performance: promotionPerformance[promotion.id] ?? buildFallbackPerformance(promotion),
      }))
      .sort((left, right) => {
        if (right.performance.redemptions !== left.performance.redemptions) {
          return right.performance.redemptions - left.performance.redemptions;
        }

        if (right.performance.clicks !== left.performance.clicks) {
          return right.performance.clicks - left.performance.clicks;
        }

        return right.performance.views - left.performance.views;
      });
  }, [promotionPerformance, promotions]);

  const topPromotion = promotionRows[0] ?? null;
  const topCategory = useMemo(
    () => [...categoryPerformance].sort((left, right) => right.redemptions - left.redemptions)[0] ?? null,
    [categoryPerformance]
  );
  const trendChartData = useMemo(
    () => selectedPromotionTrends.map((entry) => ({ ...entry, label: formatChartDate(entry.date) })),
    [selectedPromotionTrends]
  );
  const categoryChartData = useMemo(
    () =>
      [...categoryPerformance]
        .sort((left, right) => right.views - left.views)
        .slice(0, 6)
        .map((entry) => ({ ...entry, shortName: entry.categoryName })),
    [categoryPerformance]
  );
  const funnelChartData = useMemo(() => {
    if (!selectedPromotionFunnel) {
      return [];
    }

    return [
      { stage: "Views", count: selectedPromotionFunnel.views, fill: FUNNEL_BAR_COLORS[0] },
      { stage: "Clicks", count: selectedPromotionFunnel.clicks, fill: FUNNEL_BAR_COLORS[1] },
      { stage: "Redemptions", count: selectedPromotionFunnel.redemptions, fill: FUNNEL_BAR_COLORS[2] },
    ];
  }, [selectedPromotionFunnel]);

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
              <h1 className="text-3xl font-bold md:text-4xl">Business analytics</h1>
              <Badge variant="outline">Owner view</Badge>
            </div>
            <p className="max-w-3xl text-muted-foreground">
              Track promotion reach, conversion, category performance, and moderation pressure from one place.
            </p>
            {businessAnalytics?.businessName ? (
              <p className="text-sm text-muted-foreground">{businessAnalytics.businessName}</p>
            ) : null}
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
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild>
              <Link to="/promotions/new">Create promotion</Link>
            </Button>
          </div>
        </section>

        {businessSetupRequired ? (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Finish your business setup</CardTitle>
              <CardDescription>
                Analytics will unlock as soon as your business profile exists and promotions start collecting events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/create-business-owner-account">Complete setup</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isLoadingBase ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={`analytics-skeleton-${index}`} className="h-32" />
              ))}
            </section>
            <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <Skeleton className="h-[420px]" />
              <Skeleton className="h-[420px]" />
            </section>
          </>
        ) : null}

        {!isLoadingBase && !businessSetupRequired ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AnalyticsMetricCard
                label="Total promotions"
                value={formatCount(businessAnalytics?.totalPromotions ?? 0)}
                description={`${formatCount(businessAnalytics?.activePromotions ?? 0)} currently active`}
              />
              <AnalyticsMetricCard
                label="Promotion views"
                value={formatCount(businessAnalytics?.promotionViews ?? 0)}
                description={`${formatCount(businessAnalytics?.promotionClicks ?? 0)} clicks from the same campaigns`}
              />
              <AnalyticsMetricCard
                label="Redemptions"
                value={formatCount(businessAnalytics?.promotionRedemptions ?? 0)}
                description={`${formatCount(businessAnalytics?.openReports ?? 0)} open reports still being watched`}
              />
              <AnalyticsMetricCard
                label="Click-through rate"
                value={formatPercent(businessAnalytics?.clickThroughRate)}
                description={`${formatPercent(businessAnalytics?.redemptionRate)} redemption rate`}
              />
              <AnalyticsMetricCard
                label="Pending promotions"
                value={formatCount(businessAnalytics?.pendingPromotions ?? 0)}
                description={`${formatCount(businessAnalytics?.approvedPromotions ?? 0)} approved so far`}
              />
              <AnalyticsMetricCard
                label="Rejected promotions"
                value={formatCount(businessAnalytics?.rejectedPromotions ?? 0)}
                description={`${formatCount(businessAnalytics?.flaggedPromotions ?? 0)} still flagged`}
              />
              <AnalyticsMetricCard
                label="Reports"
                value={formatCount(businessAnalytics?.totalReports ?? 0)}
                description={`${formatCount(businessAnalytics?.resolvedReports ?? 0)} resolved`}
              />
              <AnalyticsMetricCard
                label="Best category"
                value={topCategory?.categoryName ?? "No data"}
                description={
                  topCategory
                    ? `${formatCount(topCategory.redemptions)} redemptions in the current window`
                    : "A category leader appears as events accumulate"
                }
              />
            </section>
            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Promotion trends</CardTitle>
                  <CardDescription>
                    {selectedPromotion
                      ? `${selectedPromotion.title} across the last ${timeWindowDays} days`
                      : "Pick a promotion below to inspect its trend line"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSelectedPromotion ? (
                    <Skeleton className="h-[320px]" />
                  ) : trendChartData.length > 0 ? (
                    <ChartContainer className="h-[320px] w-full aspect-auto" config={TREND_CHART_CONFIG}>
                      <LineChart data={trendChartData} margin={{ left: 12, right: 12, top: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line type="monotone" dataKey="views" stroke="var(--color-views)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="clicks" stroke="var(--color-clicks)" strokeWidth={2} dot={false} />
                        <Line
                          type="monotone"
                          dataKey="redemptions"
                          stroke="var(--color-redemptions)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                      No trend data yet for this promotion.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Selected promotion</CardTitle>
                  <CardDescription>
                    {selectedPromotionPerformance?.promotionTitle ?? "Choose a promotion from the table"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {selectedPromotion ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {formatStatusLabel(selectedPromotionPerformance?.promotionStatus ?? selectedPromotion.status)}
                        </Badge>
                        {(selectedPromotionPerformance?.flagged ?? selectedPromotion.flagged) ? (
                          <Badge variant="destructive">Flagged</Badge>
                        ) : null}
                        <Badge variant="secondary">{selectedPromotion.categoryName || "Uncategorized"}</Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Views</p>
                          <p className="text-2xl font-semibold">{formatCount(selectedPromotionPerformance?.views ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Clicks</p>
                          <p className="text-2xl font-semibold">{formatCount(selectedPromotionPerformance?.clicks ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Redemptions</p>
                          <p className="text-2xl font-semibold">
                            {formatCount(selectedPromotionPerformance?.redemptions ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Conversion</p>
                          <p className="text-2xl font-semibold">
                            {formatPercent(selectedPromotionPerformance?.conversionRate)}
                          </p>
                        </div>
                      </div>

                      {funnelChartData.length > 0 ? (
                        <>
                          <ChartContainer className="h-[220px] w-full aspect-auto" config={FUNNEL_CHART_CONFIG}>
                            <BarChart data={funnelChartData} margin={{ left: 12, right: 12 }}>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="stage" tickLine={false} axisLine={false} />
                              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="count" radius={4}>
                                {funnelChartData.map((entry) => (
                                  <Cell key={entry.stage} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ChartContainer>

                          <div className="grid gap-2 text-sm text-muted-foreground">
                            <p>View to click: {formatPercent(selectedPromotionFunnel?.viewToClickRate)}</p>
                            <p>Click to redeem: {formatPercent(selectedPromotionFunnel?.clickToRedeemRate)}</p>
                            <p>Click drop-off: {formatPercent(selectedPromotionFunnel?.clickDropOffRate)}</p>
                          </div>
                        </>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                          <Link to={`/promotion/${selectedPromotion.id}`}>Open public view</Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link to={`/promotions/${selectedPromotion.id}/edit`}>Edit promotion</Link>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No promotion has been selected yet. Create one or pick an existing campaign below.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Category performance</CardTitle>
                  <CardDescription>
                    Views and redemptions by category over the last {timeWindowDays} days.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingCategories ? (
                    <Skeleton className="h-[320px]" />
                  ) : categoryChartData.length > 0 ? (
                    <ChartContainer className="h-[320px] w-full aspect-auto" config={CATEGORY_CHART_CONFIG}>
                      <BarChart data={categoryChartData} margin={{ left: 12, right: 12, top: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="shortName"
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={64}
                        />
                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="views" fill="var(--color-views)" radius={4} />
                        <Bar dataKey="redemptions" fill="var(--color-redemptions)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                      Category analytics will appear once events are recorded.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Performance notes</CardTitle>
                  <CardDescription>Quick reads for owner decisions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Top promotion</p>
                    <p className="text-lg font-semibold">{topPromotion?.promotion.title ?? "No data yet"}</p>
                    <p className="text-sm text-muted-foreground">
                      {topPromotion
                        ? `${formatCount(topPromotion.performance.redemptions)} redemptions and ${formatPercent(
                            topPromotion.performance.conversionRate
                          )} conversion`
                        : "The first winning campaign will show here"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Top category</p>
                    <p className="text-lg font-semibold">{topCategory?.categoryName ?? "No data yet"}</p>
                    <p className="text-sm text-muted-foreground">
                      {topCategory
                        ? `${formatCount(topCategory.views)} views and ${formatCount(topCategory.redemptions)} redemptions`
                        : "As category events build up, the strongest category will appear here"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Moderation pressure</p>
                    <p className="text-lg font-semibold">
                      {formatCount(businessAnalytics?.flaggedPromotions ?? 0)} flagged promotions
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCount(businessAnalytics?.openReports ?? 0)} reports are still open across your campaigns.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Promotion window</p>
                    <p className="text-lg font-semibold">Last {timeWindowDays} days</p>
                    <p className="text-sm text-muted-foreground">
                      Use the time window control to compare short bursts against longer-running campaigns.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
            <section>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Promotion drill-down</CardTitle>
                  <CardDescription>
                    Select a promotion to refresh the charts above and inspect its funnel in detail.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {promotionRows.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Promotion</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Clicks</TableHead>
                          <TableHead>Redemptions</TableHead>
                          <TableHead>CTR</TableHead>
                          <TableHead>Conversion</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promotionRows.map(({ promotion, performance }) => {
                          const isSelected = promotion.id === selectedPromotionId;

                          return (
                            <TableRow key={promotion.id} className={isSelected ? "bg-muted/50" : undefined}>
                              <TableCell>
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    className="text-left font-medium text-foreground"
                                    onClick={() => setSelectedPromotionId(promotion.id)}
                                  >
                                    {promotion.title}
                                  </button>
                                  <div className="flex flex-wrap gap-2">
                                    {promotion.categoryName ? (
                                      <Badge variant="secondary">{promotion.categoryName}</Badge>
                                    ) : null}
                                    {performance.flagged ? <Badge variant="destructive">Flagged</Badge> : null}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{formatStatusLabel(performance.promotionStatus)}</TableCell>
                              <TableCell>{formatCount(performance.views)}</TableCell>
                              <TableCell>{formatCount(performance.clicks)}</TableCell>
                              <TableCell>{formatCount(performance.redemptions)}</TableCell>
                              <TableCell>{formatPercent(performance.clickThroughRate)}</TableCell>
                              <TableCell>{formatPercent(performance.conversionRate)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedPromotionId(promotion.id)}
                                >
                                  {isSelected ? "Selected" : "Drill down"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                      Create your first promotion to start collecting analytics.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Category breakdown table</CardTitle>
                  <CardDescription>
                    The same category view in table form for deeper comparisons.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {categoryPerformance.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Promotions</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Clicks</TableHead>
                          <TableHead>Redemptions</TableHead>
                          <TableHead>CTR</TableHead>
                          <TableHead>Conversion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryPerformance.map((entry) => (
                          <TableRow key={entry.categoryId}>
                            <TableCell className="font-medium">{entry.categoryName}</TableCell>
                            <TableCell>{formatCount(entry.promotionCount)}</TableCell>
                            <TableCell>{formatCount(entry.views)}</TableCell>
                            <TableCell>{formatCount(entry.clicks)}</TableCell>
                            <TableCell>{formatCount(entry.redemptions)}</TableCell>
                            <TableCell>{formatPercent(entry.clickThroughRate)}</TableCell>
                            <TableCell>{formatPercent(entry.conversionRate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                      Category data will show up after your promotions receive traffic.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
};

export default BusinessAnalyticsPage;

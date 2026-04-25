# PromoHub Reporting And Analytics Plan

## Why this document exists

PromoHub already has the beginnings of two separate data stories:

1. customer engagement on promotions
2. admin moderation and report handling

To implement reporting well, those two stories should be modeled together in a way that supports:

- business-owner performance dashboards
- admin compliance and moderation dashboards
- final-year-project reporting with clear metric definitions

This plan arranges the data first, then shows a practical implementation path.

## What already exists in the frontend

The current frontend already expects:

- promotion engagement tracking through `/view`, `/click`, and `/redeem`
- platform and business analytics endpoints
- report workflows with `OPEN`, `REVIEWING`, and `CLOSED`
- moderation outcomes such as `DISMISS_REPORT`, `KEEP_PROMOTION_FLAGGED`, and `REJECT_PROMOTION`
- promotion moderation actions such as approve, reject, and flagged follow-up

That means the clean backend direction is not to invent a new analytics language, but to make analytics reuse the exact workflow vocabulary already present in the app.

## Reporting scope

### Business-owner reporting

- promotion performance
- funnel analysis
- time trends
- category performance
- top and underperforming promotions
- moderation impact on business promotions

### Admin reporting

- open, reviewing, and closed reports
- flagged promotions
- approved vs rejected promotions
- report reasons and repeat-reporter patterns
- moderation turnaround time
- business compliance trends

## Recommended data arrangement

Use a three-layer approach.

### Layer 1: Operational tables

These are your existing business tables.

- `users`
- `businesses`
- `categories`
- `promotions`
- `reports`

These remain the source of truth for current state.

### Layer 2: Event tables

These capture history. They are the foundation of reporting.

#### A. `promotion_engagement_events`

Purpose: raw user interaction history.

Suggested columns:

- `id`
- `promotion_id`
- `business_id`
- `category_id`
- `user_id` nullable
- `event_type` enum: `VIEW`, `CLICK`, `REDEEM`, optional later `SAVE`, `SHARE`
- `city` nullable
- `device_type` nullable
- `session_id` nullable
- `source_channel` nullable
- `created_at`

Notes:

- store one row per interaction
- this is where funnel, trends, category, location, and user engagement metrics come from

#### B. `promotion_moderation_events`

Purpose: track admin actions and moderation state changes as reportable events.

Suggested columns:

- `id`
- `promotion_id`
- `business_id`
- `report_id` nullable
- `admin_id` nullable
- `action_type` enum
- `from_status` nullable
- `to_status` nullable
- `report_workflow_status` nullable
- `resolution_action` nullable
- `reason_code` nullable
- `note` nullable
- `created_at`

Suggested `action_type` values:

- `REPORT_CREATED`
- `REPORT_REVIEW_STARTED`
- `REPORT_CLOSED`
- `REPORT_DISMISSED`
- `PROMOTION_FLAGGED`
- `PROMOTION_UNFLAGGED`
- `PROMOTION_APPROVED`
- `PROMOTION_REJECTED`
- `PROMOTION_RESUBMITTED`
- `BUSINESS_VERIFICATION_APPROVED`
- `BUSINESS_VERIFICATION_REJECTED`
- `MORE_DOCUMENTS_REQUESTED`

Why this table matters:

- you asked to include admin actions such as closed and flagged in analysis
- this table makes those actions first-class analytics facts instead of side effects hidden inside status fields

#### C. Optional `promotion_status_history`

Purpose: preserve every promotion status transition.

Suggested columns:

- `id`
- `promotion_id`
- `old_status`
- `new_status`
- `changed_by_user_id` nullable
- `change_source` enum: `ADMIN_ACTION`, `REPORT_RESOLUTION`, `BUSINESS_RESUBMISSION`, `SYSTEM`
- `created_at`

This can be skipped if `promotion_moderation_events` already covers the same transitions clearly.

### Layer 3: Aggregated metrics tables

Use these for dashboards and fast charts.

#### A. `daily_promotion_metrics`

- `id`
- `metric_date`
- `promotion_id`
- `business_id`
- `category_id`
- `total_views`
- `total_clicks`
- `total_redemptions`
- `unique_viewers`
- `unique_clickers`
- `unique_redeemers`
- `reports_created`
- `reports_closed`
- `times_flagged`
- `times_rejected`
- `times_approved`
- `last_aggregated_at`

#### B. `daily_business_metrics`

- `id`
- `metric_date`
- `business_id`
- `total_promotions`
- `active_promotions`
- `flagged_promotions`
- `rejected_promotions`
- `total_views`
- `total_clicks`
- `total_redemptions`
- `reports_received`
- `reports_closed`
- `avg_report_resolution_hours`
- `last_aggregated_at`

#### C. `daily_category_metrics`

- `id`
- `metric_date`
- `category_id`
- `total_views`
- `total_clicks`
- `total_redemptions`
- `reports_created`
- `flagged_promotions`
- `rejected_promotions`
- `last_aggregated_at`

#### D. `daily_admin_moderation_metrics`

- `id`
- `metric_date`
- `total_open_reports`
- `total_reviewing_reports`
- `total_closed_reports`
- `promotions_flagged`
- `promotions_approved`
- `promotions_rejected`
- `distinct_reported_promotions`
- `distinct_reporters`
- `avg_time_to_review_minutes`
- `avg_time_to_close_minutes`
- `last_aggregated_at`

This table is the cleanest way to surface admin-side reporting.

#### E. Monthly metrics tables

Add monthly summary tables for reporting periods that business owners and admins naturally use.

Recommended tables:

- `monthly_promotion_metrics`
- `monthly_business_metrics`
- `monthly_category_metrics`
- `monthly_admin_moderation_metrics`

Suggested monthly columns:

- `id`
- `metric_month`
- `promotion_id` or `business_id` or `category_id` where relevant
- monthly totals for views, clicks, redemptions, reports, flags, approvals, rejections
- monthly unique counts where needed
- derived rates such as CTR and conversion rate
- `last_aggregated_at`

Why monthly metrics matter:

- business owners think in months when reviewing performance
- admins often report platform health monthly
- academic reporting is easier with monthly comparisons
- long date-range dashboards become faster and easier to read

Recommended design rule:

- daily tables remain the base time-series layer
- monthly tables support executive summaries, comparisons, and long-range reporting

## Metric definitions

Define these once and keep them stable in code and in your report.

### Engagement metrics

- `views`: count of `VIEW` events
- `clicks`: count of `CLICK` events
- `redemptions`: count of `REDEEM` events
- `CTR`: `(clicks / views) * 100`
- `conversion_rate`: `(redemptions / clicks) * 100`
- `view_to_redeem_rate`: `(redemptions / views) * 100`

### Unique metrics

- `unique_viewers`: distinct `user_id`, or distinct `session_id` when user is anonymous
- `unique_clickers`
- `unique_redeemers`

### Moderation metrics

- `reports_created`: count of `REPORT_CREATED`
- `reports_closed`: count of `REPORT_CLOSED`
- `flag_rate`: `(flagged promotions / total reported promotions) * 100`
- `rejection_rate_after_report`: `(rejected promotions after report / reported promotions) * 100`
- `avg_time_to_review`: average time from report creation to first review action
- `avg_time_to_close`: average time from report creation to close action

### Risk and trust metrics

- `report_density`: reports per 1,000 views
- `repeat_reporter_count`: number of distinct reporters for a promotion
- `moderation_pressure_score`: weighted score from reports, flags, and rejections

## Business rules to fix before coding

These decisions must be explicit.

### Engagement rules

- do repeated views count as multiple total views? recommended: yes
- do you also need unique viewers? recommended: yes
- can anonymous users generate events? recommended: yes
- should redemption happen once per user per promotion? recommended: yes if the promotion rules require it

### Moderation rules

- should closed reports remain in analytics? recommended: yes
- should rejected promotions remain in historical dashboards? recommended: yes
- does a flagged promotion stay flagged until manually cleared? recommended: yes
- should report review and promotion rejection be stored as separate events? recommended: yes

### Time rules

- store all timestamps in UTC in the database
- convert to local timezone in the dashboard
- aggregate daily metrics using a fixed business timezone rule
- define month boundaries consistently, for example calendar month in the chosen reporting timezone

## Suggested backend design

### Core services

#### `PromotionEngagementService`

Responsibilities:

- record `VIEW`, `CLICK`, `REDEEM`
- validate promotion exists
- attach business, category, city, and user context

Suggested methods:

- `recordView(Long promotionId, Long userId, String city, String sessionId)`
- `recordClick(Long promotionId, Long userId, String city, String sessionId)`
- `recordRedeem(Long promotionId, Long userId, String city, String sessionId)`

#### `ModerationAnalyticsEventService`

Responsibilities:

- record admin/report workflow events
- convert moderation actions into reportable history

Suggested methods:

- `recordReportCreated(Long reportId, Long promotionId, Long reporterId, String reason)`
- `recordReportReviewStarted(Long reportId, Long promotionId, Long adminId)`
- `recordReportClosed(Long reportId, Long promotionId, Long adminId, String resolutionAction)`
- `recordPromotionFlagged(Long promotionId, Long adminId, String note)`
- `recordPromotionApproved(Long promotionId, Long adminId)`
- `recordPromotionRejected(Long promotionId, Long adminId, String reason)`

#### `PromotionAnalyticsService`

Responsibilities:

- compute promotion and business analytics
- expose DTOs for dashboards

Suggested methods:

- `getPromotionPerformance(Long promotionId)`
- `getPromotionFunnel(Long promotionId)`
- `getPromotionDailyTrend(Long promotionId, LocalDate from, LocalDate to)`
- `getBusinessDashboard(Long businessId, LocalDate from, LocalDate to)`
- `getBusinessCategoryPerformance(Long businessId, LocalDate from, LocalDate to)`
- `getAdminModerationDashboard(LocalDate from, LocalDate to)`

#### `AnalyticsAggregationService`

Responsibilities:

- build daily summary tables from raw events
- build monthly summary tables from daily summaries or raw events

Suggested methods:

- `aggregateDailyPromotionMetrics(LocalDate date)`
- `aggregateDailyBusinessMetrics(LocalDate date)`
- `aggregateDailyCategoryMetrics(LocalDate date)`
- `aggregateDailyModerationMetrics(LocalDate date)`
- `aggregateMonthlyPromotionMetrics(YearMonth month)`
- `aggregateMonthlyBusinessMetrics(YearMonth month)`
- `aggregateMonthlyCategoryMetrics(YearMonth month)`
- `aggregateMonthlyModerationMetrics(YearMonth month)`

## Suggested API contracts

### Business analytics

- `GET /api/analytics/business/{businessId}/dashboard`
- `GET /api/analytics/business/{businessId}/promotions`
- `GET /api/analytics/business/{businessId}/promotions/{promotionId}`
- `GET /api/analytics/business/{businessId}/trends?from=2026-03-01&to=2026-03-31&grain=DAY`
- `GET /api/analytics/business/{businessId}/trends?from=2026-01-01&to=2026-12-31&grain=MONTH`
- `GET /api/analytics/business/{businessId}/categories?from=...&to=...`
- `GET /api/analytics/business/{businessId}/funnel/{promotionId}`
- `GET /api/analytics/business/{businessId}/monthly-summary?year=2026`

### Admin analytics

- `GET /api/analytics/admin/platform-summary`
- `GET /api/analytics/admin/moderation-summary?from=...&to=...`
- `GET /api/analytics/admin/moderation-summary?from=2026-01-01&to=2026-12-31&grain=MONTH`
- `GET /api/analytics/admin/report-reasons?from=...&to=...`
- `GET /api/analytics/admin/cities?from=...&to=...`
- `GET /api/analytics/admin/flagged-promotions?from=...&to=...`
- `GET /api/analytics/admin/monthly-summary?year=2026`

## Dashboard output suggestions

### Business-owner dashboard

- total promotions
- total views, clicks, redemptions
- CTR and conversion rate
- best performing promotion
- worst performing promotion
- daily trend chart
- category chart
- funnel card
- moderation impact card:
  - promotions flagged
  - promotions rejected
  - reports received

### Admin dashboard

- open reports
- reviewing reports
- closed reports
- flagged promotions
- approved promotions
- rejected promotions
- average moderation turnaround
- top report reasons
- top flagged categories
- cities with most reported promotions

## How to include admin actions in analysis

Do not treat moderation as an afterthought. Make it a reportable dimension.

### Recommended analysis additions

- promotions with highest report density
- categories with most flags
- businesses with repeated rejected promotions
- average time from report creation to admin action
- ratio of dismissed reports vs enforced reports
- engagement before and after a promotion is flagged
- approvals, rejections, and flags over time

### Especially useful combined analyses

1. `engagement vs moderation`
   - high views + high reports = risky visibility
   - high clicks + high dismiss rate = maybe false alarm or noisy audience

2. `category vs moderation`
   - which categories generate the most reports
   - which categories are most often rejected after review

3. `business quality trend`
   - does a business improve after earlier rejected promotions
   - are flagged promotions concentrated in a few businesses

## Recommended DTOs

### `PromotionPerformanceDto`

- `promotionId`
- `promotionTitle`
- `categoryName`
- `views`
- `clicks`
- `redemptions`
- `clickThroughRate`
- `conversionRate`
- `reportsCreated`
- `timesFlagged`
- `timesRejected`

### `DailyTrendDto`

- `date`
- `views`
- `clicks`
- `redemptions`
- `reportsCreated`
- `flagsRaised`
- `rejections`

### `MonthlyTrendDto`

- `month`
- `views`
- `clicks`
- `redemptions`
- `reportsCreated`
- `flagsRaised`
- `rejections`
- `clickThroughRate`
- `conversionRate`

### `FunnelAnalyticsDto`

- `views`
- `clicks`
- `redemptions`
- `viewToClickRate`
- `clickToRedeemRate`
- `viewToRedeemRate`

### `BusinessDashboardDto`

- `businessId`
- `totalPromotions`
- `activePromotions`
- `views`
- `clicks`
- `redemptions`
- `clickThroughRate`
- `conversionRate`
- `reportsReceived`
- `flaggedPromotions`
- `rejectedPromotions`
- `bestPerformingPromotion`
- `monthlySummary`

### `AdminModerationDashboardDto`

- `openReports`
- `reviewingReports`
- `closedReports`
- `flaggedPromotions`
- `approvedPromotions`
- `rejectedPromotions`
- `avgTimeToReviewMinutes`
- `avgTimeToCloseMinutes`
- `topReportReasons`
- `topFlaggedCategories`
- `monthlySummary`

## SQL and query suggestions

### Promotion daily trend

Use `promotion_engagement_events` grouped by date.

### Moderation trend

Use `promotion_moderation_events` grouped by `action_type` and date.

### Category performance

Join:

- `promotion_engagement_events`
- `promotions`
- `categories`

### Report turnaround

Measure difference between:

- `REPORT_CREATED`
- first `REPORT_REVIEW_STARTED`
- final `REPORT_CLOSED`

## Scheduled aggregation

Recommended schedule:

- every night after midnight: aggregate yesterday
- at the start of each month: finalize the previous month
- optional hourly job for same-day near-real-time dashboard refresh

Suggested pattern:

1. pull raw events for the target date
2. recompute that date idempotently
3. upsert into daily summary tables
4. recompute the affected month
5. upsert into monthly summary tables

Idempotent aggregation is important because reports may be reviewed after the original event day.

Recommended monthly strategy:

- generate monthly metrics from daily tables first
- only aggregate directly from raw events if you have a specific accuracy or audit reason

Why this is better:

- daily data is already validated
- monthly rollups are faster
- recomputation is simpler

## Seeder and sample data plan

Use a hybrid:

- synthetic generator for scale
- a smaller curated sample for demos

## Spring Boot data seeder / simulator design

The cleanest approach is to split seeding into two parts:

1. reference data seeding
2. activity simulation

That keeps the system understandable and makes it easier to rerun only the activity layer when you want fresh analytics.

### Recommended Spring Boot structure

#### `ReferenceDataSeeder`

Purpose:

- create categories
- create admin users
- create business owners
- create consumer users
- create businesses
- create promotions

Use this to build the static world of PromoHub.

#### `PromotionScenarioFactory`

Purpose:

- assign each promotion a behavior profile

Suggested profiles:

- `HIGH_CONVERSION`
- `HIGH_TRAFFIC_LOW_CONVERSION`
- `AVERAGE`
- `LOW_TRAFFIC`
- `RISKY_REPORTED`

This is the trick that makes your analytics look realistic. Different promotions should not all behave the same way.

#### `EngagementSimulationService`

Purpose:

- generate `VIEW`, `CLICK`, and `REDEEM` events over time
- spread events across cities and hours
- preserve the funnel shape: views > clicks > redemptions

#### `ModerationSimulationService`

Purpose:

- create reports for a smaller subset of promotions
- simulate report review start
- simulate flag, dismiss, or reject actions
- write moderation analytics events

#### `AnalyticsSeedRunner`

Purpose:

- orchestrate the full seed process
- run only in `dev` or `demo` profile
- optionally clear old synthetic data first

Use `ApplicationRunner` or `CommandLineRunner` for this.

### Suggested configuration

Add a property class such as:

- `app.seed.enabled`
- `app.seed.reset`
- `app.seed.random-seed`
- `app.seed.users`
- `app.seed.businesses`
- `app.seed.promotions`
- `app.seed.lookback-days`

Why this helps:

- you can generate a small demo dataset or a larger analytics dataset without changing code
- using the same random seed gives repeatable results

### Recommended execution flow

1. create categories
2. create users
3. create businesses
4. create promotions
5. assign each promotion a scenario profile
6. generate engagement events for the last 30 to 90 days
7. generate report and moderation events for a small subset
8. run aggregation jobs to populate daily metrics tables

### Reproducibility

Use a seeded random generator.

Recommended:

- `Random`
- `SplittableRandom`

Example idea:

```java
var random = new SplittableRandom(seedProperties.getRandomSeed());
```

If you use a fixed seed such as `42`, the same dataset shape is generated every time, which is excellent for demos and screenshots.

### High-level runner skeleton

```java
@Component
@RequiredArgsConstructor
@Profile({"dev", "demo"})
public class AnalyticsSeedRunner implements ApplicationRunner {

    private final SeedProperties seedProperties;
    private final ReferenceDataSeeder referenceDataSeeder;
    private final EngagementSimulationService engagementSimulationService;
    private final ModerationSimulationService moderationSimulationService;
    private final AnalyticsAggregationService analyticsAggregationService;

    @Override
    public void run(ApplicationArguments args) {
        if (!seedProperties.isEnabled()) {
            return;
        }

        SeedContext context = referenceDataSeeder.seedReferenceData();

        engagementSimulationService.generate(context);
        moderationSimulationService.generate(context);

        for (LocalDate date = LocalDate.now().minusDays(seedProperties.getLookbackDays());
             !date.isAfter(LocalDate.now());
             date = date.plusDays(1)) {
            analyticsAggregationService.aggregateDailyPromotionMetrics(date);
            analyticsAggregationService.aggregateDailyBusinessMetrics(date);
            analyticsAggregationService.aggregateDailyCategoryMetrics(date);
            analyticsAggregationService.aggregateDailyModerationMetrics(date);
        }
    }
}
```

### Seed context object

Return a context object from the reference seeder so the simulation layer can reuse created records.

Suggested contents:

- `List<Category>`
- `List<User> admins`
- `List<User> consumers`
- `List<Business> businesses`
- `List<Promotion> promotions`
- `Map<Long, Business> businessById`

### Promotion scenario design

For each promotion, randomly assign a scenario with weighted probability.

Example:

- 20% `HIGH_CONVERSION`
- 25% `HIGH_TRAFFIC_LOW_CONVERSION`
- 35% `AVERAGE`
- 15% `LOW_TRAFFIC`
- 5% `RISKY_REPORTED`

Each scenario should define:

- daily expected views range
- click probability
- redeem probability after click
- report probability
- moderation outcome probability

Example shape:

```java
public record PromotionScenario(
    int minDailyViews,
    int maxDailyViews,
    double clickRate,
    double redeemRate,
    double reportRate,
    double flagRate,
    double rejectRate
) {}
```

### Time distribution rules

Do not generate all events at one timestamp.

Use:

- more activity on weekends
- stronger evening traffic from 6 PM to 9 PM
- lower overnight traffic
- random distribution across the last 30 to 90 days

Example helper:

```java
private LocalDateTime randomEventTime(LocalDate date, SplittableRandom random) {
    int hour = weightedHour(random);
    int minute = random.nextInt(60);
    int second = random.nextInt(60);
    return date.atTime(hour, minute, second);
}
```

### Zimbabwe-aware weighting

Use realistic local city weighting.

Example:

- Harare: 45%
- Bulawayo: 20%
- Mutare: 15%
- Gweru: 10%
- Masvingo: 10%

You can also bias some categories:

- food: higher redemption
- electronics: high views, lower redemption
- fashion: balanced clicks and redemptions
- events: stronger weekend traffic

### Engagement generation pattern

Generate by promotion, by day.

Suggested logic:

1. for each promotion, decide a daily traffic level from its scenario
2. for each simulated view:
   - insert a `VIEW`
   - maybe insert a `CLICK`
   - maybe insert a `REDEEM`

Keep causality clean:

- no redeem before click
- no click before view

Example pseudo-flow:

```java
for (Promotion promotion : context.promotions()) {
    PromotionScenario scenario = scenarioFactory.forPromotion(promotion);

    for (LocalDate date : datesInRange) {
        int dailyViews = randomBetween(scenario.minDailyViews(), scenario.maxDailyViews(), random);

        for (int i = 0; i < dailyViews; i++) {
            SimulationActor actor = actorPicker.pickConsumerOrAnonymous(random);
            LocalDateTime viewedAt = randomEventTime(date, random);
            recordView(promotion, actor, viewedAt);

            if (random.nextDouble() < scenario.clickRate()) {
                LocalDateTime clickedAt = viewedAt.plusMinutes(random.nextInt(1, 60));
                recordClick(promotion, actor, clickedAt);

                if (random.nextDouble() < scenario.redeemRate()) {
                    LocalDateTime redeemedAt = clickedAt.plusHours(random.nextInt(1, 48));
                    recordRedeem(promotion, actor, redeemedAt);
                }
            }
        }
    }
}
```

### Moderation simulation pattern

Only a minority of promotions should be reported.

Recommended:

- 5% to 12% of promotions get reports
- risky or misleading scenarios get more reports
- only some reports lead to flags
- only some flagged promotions end in rejection

Suggested flow:

1. choose reported promotions
2. create 1 to 5 reports per selected promotion
3. for each report:
   - write `REPORT_CREATED`
   - maybe write `REPORT_REVIEW_STARTED`
   - then write final action:
     - `REPORT_DISMISSED`
     - `PROMOTION_FLAGGED`
     - `PROMOTION_REJECTED`

This creates realistic admin analytics instead of a flat fake dataset.

### Unique user handling

To support both total and unique metrics:

- sometimes reuse the same consumer on multiple days
- sometimes use anonymous sessions
- sometimes let one consumer view several promotions in the same category

That gives you:

- repeat visitors
- loyal consumers
- realistic unique counts

### Keep the data believable

Avoid:

- identical view counts across promotions
- equal clicks and redemptions
- all promotions having reports
- all reports being rejected
- all cities having the same traffic

Good synthetic data has variation, not randomness for its own sake.

### Idempotency and reset strategy

In development, one of these patterns works well:

#### Option 1: clear synthetic data before reseeding

Good for demos.

#### Option 2: skip seeding if data already exists

Good when you want stability.

Recommended implementation:

- add `app.seed.reset=true` for full reseed
- otherwise skip when synthetic data already exists

If you want to distinguish seeded from real data, add:

- `created_by = 'SEEDER'`
- or `synthetic = true`

to your event tables.

### Performance tips

- generate entities in memory and save in batches
- use `saveAll()` in chunks such as 500 or 1000
- avoid one insert per event if volume gets high
- aggregate only after batch inserts finish

### What I would generate first

For a solid PromoHub demo:

- 6 categories
- 60 businesses
- 300 promotions
- 2,000 consumers
- 100,000 engagement events
- 1,500 to 3,000 reports
- moderation events for a subset of those reports

That is enough to make your charts, funnels, and admin dashboards look alive.

### Best practice for your project

Use one curated deterministic seed for demonstrations and one larger optional seed for stress-testing.

Example modes:

- `demo`: smaller, cleaner, presentation-friendly
- `analytics`: bigger, noisier, more realistic

Then switch with profiles or properties instead of editing code.

Recommended seeded distribution:

- 50 to 100 businesses
- 300 promotions
- 2,000 users
- 100,000 engagement events
- report and moderation events layered on top

Suggested realism rules:

- views > clicks > redemptions
- Harare has the highest traffic
- food converts better than electronics
- a small percentage of promotions receive reports
- only some reports lead to flags
- only some flagged promotions are rejected

This gives you realistic engagement and moderation analytics.

## Implementation phases

### Phase 1: Definitions and schema

- finalize metrics and rules
- add `promotion_engagement_events`
- add `promotion_moderation_events`
- add enums

### Phase 2: Event capture

- update `/view`, `/click`, `/redeem` to write raw event rows
- update report creation and admin action flows to write moderation events

### Phase 3: Analytics queries

- promotion performance
- funnel
- daily trends
- category performance
- admin moderation summary

### Phase 4: Aggregation

- add daily summary tables
- add monthly summary tables
- add scheduled jobs

### Phase 5: Dashboard integration

- business-owner analytics page
- admin moderation analytics page
- charts and drill-down tables

### Phase 6: Seed data and validation

- generate engagement events
- generate report and moderation events
- verify charts with realistic time spread

## Detailed implementation roadmap

This section turns the high-level phases into an execution plan you can actually follow in order.

The sequence matters:

- first define what the data means
- then store the right raw history
- then calculate analytics
- then expose it through APIs
- then make it visible in dashboards

If you try to jump straight to charts before the data model is stable, you will end up rewriting queries and DTOs later.

### Stage 1: Analytics definitions and reporting rules

#### Main responsibility

This stage defines the meaning of every metric before code is written.

It answers questions like:

- what exactly counts as a view
- whether repeat views count
- whether anonymous activity is allowed
- whether redemption is once per user or many times
- whether closed reports remain in analytics
- how flagged promotions should behave historically

#### Why this stage exists

Reporting systems fail when teams calculate the same number in different ways.

For example:

- one query may count all clicks
- another may count only unique users
- a dashboard may call both of them "clicks"

That creates inconsistent analytics and weakens your academic write-up.

#### What to produce

- a metric definition sheet
- enum definitions for event types and moderation actions
- rules for unique vs total counts
- timezone rules
- report workflow rules

#### What this stage is responsible for

- locking the language of analytics
- removing ambiguity from later stages
- making sure business-owner and admin dashboards use the same metric logic

#### Done criteria

This stage is done when:

- you can define every metric in one sentence
- you can explain how it is calculated
- there are no unresolved rule conflicts

### Stage 2: Database schema and persistence model

#### Main responsibility

This stage creates the tables and entities needed to store analytics data correctly.

#### What should be implemented here

- `promotion_engagement_events`
- `promotion_moderation_events`
- daily summary tables
- monthly summary tables
- supporting enums
- indexes for date, promotion, business, category, and event type

#### Why this stage exists

Your current operational tables tell you the current state of a promotion or report, but not the full story over time.

Analytics needs history, not just latest status.

For example:

- a promotion may be flagged today, approved tomorrow, and rejected next week
- if you only keep the latest status, you lose the timeline

The event tables solve that problem.

#### What this stage is responsible for

- creating the raw storage foundation
- preserving time-based history
- making queries possible later without ugly workarounds

#### Recommended implementation tasks

- create migration scripts
- create JPA entities
- create repositories
- add indexes on:
  - `promotion_id`
  - `business_id`
  - `category_id`
  - `event_type`
  - `action_type`
  - `created_at`

#### Done criteria

This stage is done when:

- the schema can store both engagement and moderation events
- a single promotion can accumulate a full historical trail
- daily and monthly summary tables exist even if they are not filled yet

### Stage 3: Event capture integration

#### Main responsibility

This stage connects real application actions to the analytics tables.

This is where PromoHub stops being analytics-ready on paper and starts actually collecting data.

#### What should be captured

##### Engagement events

- promotion viewed
- promotion clicked
- promotion redeemed

##### Moderation events

- report created
- report review started
- report closed
- promotion flagged
- promotion approved
- promotion rejected
- business verification actions where relevant

#### Why this stage exists

If raw events are not captured consistently, everything after this stage becomes inaccurate.

Charts may still render, but the numbers will be misleading.

#### What this stage is responsible for

- translating business actions into analytics events
- attaching the right context to each event
- making sure no important workflow step disappears without a trace

#### Recommended implementation tasks

- update `/view`, `/click`, `/redeem` handlers
- update report creation flow
- update report reviewing and resolution flow
- update promotion moderation flow
- optionally update business verification flow

#### Key design responsibility

This stage must capture both:

- the action itself
- the surrounding context

For example, a `CLICK` event should carry:

- promotion id
- business id
- category id
- user id or session id
- city
- timestamp

That context is what makes later slicing and grouping possible.

#### Done criteria

This stage is done when:

- real application actions generate raw analytics rows
- the same action always produces the same event pattern
- the stored events contain enough detail for later reporting

### Stage 4: Raw analytics query layer

#### Main responsibility

This stage creates the first reporting logic from raw events.

You do not optimize yet. You prove correctness first.

#### What should be implemented here

- promotion performance query
- funnel query
- daily trend query
- category performance query
- admin moderation summary query
- report turnaround query

#### Why this stage exists

This stage validates the data model.

If you can answer the main business questions from raw events, the schema is working.
If you cannot, the issue is usually in event design or missing context.

#### What this stage is responsible for

- turning raw history into meaningful metrics
- creating DTOs that match reporting needs
- exposing the first trustworthy analytics outputs

#### Recommended implementation tasks

- create `PromotionAnalyticsService`
- create `AdminAnalyticsService` or admin methods inside the same service
- write repository queries using JPQL, Criteria, or native SQL where needed
- create DTOs for:
  - promotion performance
  - trend series
  - funnel
  - business dashboard
  - admin moderation dashboard

#### Important design principle

At this stage, correctness matters more than speed.

Use raw events first because:

- you can verify calculations directly
- you can compare query results against seeded data
- debugging is easier than debugging precomputed tables

#### Done criteria

This stage is done when:

- the main reports work directly from raw event data
- your core metrics can be tested and explained
- DTO responses are stable enough for frontend work

### Stage 5: Aggregation and daily summary jobs

#### Main responsibility

This stage improves performance and makes dashboard loading practical.

Even though the stage title says daily summary jobs, this stage should own both daily and monthly rollups.

#### What should be implemented here

- daily promotion aggregation
- daily business aggregation
- daily category aggregation
- daily admin moderation aggregation
- monthly promotion aggregation
- monthly business aggregation
- monthly category aggregation
- monthly admin moderation aggregation
- scheduled jobs to recompute metrics

#### Why this stage exists

Raw event queries are great for correctness, but dashboards should not scan huge event tables every time.

Summary tables solve that problem by precomputing totals for each day.

Monthly summary tables solve a second problem:

- business reporting over long periods becomes easier to query
- yearly dashboards can render from 12 monthly rows instead of hundreds of daily rows

#### What this stage is responsible for

- transforming raw event history into dashboard-ready summaries
- making chart and table endpoints faster
- supporting time-series visualizations cleanly
- supporting monthly executive-style reporting

#### Recommended implementation tasks

- implement `AnalyticsAggregationService`
- use upsert logic so recomputing a day replaces old values safely
- run aggregation nightly
- recompute monthly totals whenever a day inside that month changes
- optionally support on-demand backfill for old dates

#### Design responsibility

This stage must be idempotent.

That means:

- if you rerun aggregation for April 10, 2026, you should get the same correct totals
- no duplicate rows should appear
- if you rerun April 2026 monthly aggregation, the final monthly totals should still be correct

That is especially important because moderation events may arrive later than the original user engagement events.

#### Done criteria

This stage is done when:

- daily summary tables populate correctly
- monthly summary tables populate correctly
- dashboard-oriented queries can use summary tables
- rerunning aggregation does not corrupt totals

### Stage 6: Seeder and simulator implementation

#### Main responsibility

This stage creates realistic synthetic data so the reporting module is demonstrable.

#### Why this stage exists

Without enough data:

- the charts look empty
- time trends look flat
- funnel analysis looks artificial
- moderation analytics look meaningless

Synthetic data is what makes the system visible and defendable in a final-year project.

#### What this stage is responsible for

- creating a believable PromoHub world
- generating realistic variation across promotions, users, cities, and dates
- producing enough records to stress-test analytics

#### Recommended implementation tasks

- implement `SeedProperties`
- implement `ReferenceDataSeeder`
- implement `PromotionScenarioFactory`
- implement `EngagementSimulationService`
- implement `ModerationSimulationService`
- implement `AnalyticsSeedRunner`

#### Design responsibility

This stage should not just create random noise.
It should create shaped behavior.

Examples:

- food promotions redeem more often
- Harare generates more traffic
- some promotions are risky and receive more reports
- only some flagged promotions get rejected

That pattern is what makes your analytics feel real.

#### Done criteria

This stage is done when:

- seeded data produces believable funnels
- trends vary over time
- business and admin dashboards have enough variety to tell a story

### Stage 7: API layer and access control

#### Main responsibility

This stage exposes analytics to the frontend through clear, role-safe endpoints.

#### Why this stage exists

Even good analytics logic is not usable until it is packaged into stable APIs.

This is also where you enforce who can see what.

#### What this stage is responsible for

- creating controller endpoints
- mapping service results to response DTOs
- enforcing role-based security
- preventing businesses from seeing other businesses' internal analytics

#### Recommended implementation tasks

- create business analytics controller
- create admin analytics controller
- validate ownership for business endpoints
- validate admin role for platform-wide endpoints
- support date range filters and grain parameters such as `DAY` and `MONTH`

#### Security responsibility

This stage must ensure:

- business owners only see their own business metrics
- admins can see platform-wide and moderation metrics
- consumers do not access internal reporting endpoints

#### Done criteria

This stage is done when:

- frontend can request analytics cleanly
- endpoints return role-appropriate data
- unauthorized access is blocked

### Stage 8: Frontend dashboards and visualization

#### Main responsibility

This stage turns analytics into decision-support screens.

#### Why this stage exists

The backend makes reporting correct.
The dashboard makes reporting useful.

This is the stage where users can actually interpret what is happening.

#### What this stage is responsible for

- rendering business-owner performance analytics
- rendering admin moderation and compliance analytics
- presenting trends, breakdowns, and funnel results clearly

#### Recommended implementation tasks

- create business analytics dashboard page or dashboard section
- create admin analytics dashboard section
- add line charts for trends
- add monthly comparison charts
- add bar charts for categories
- add funnel or staged metric cards
- add top-performing and underperforming promotion tables
- add moderation insight cards for flagged, closed, and rejected items

#### Design responsibility

This stage should focus on interpretation, not just display.

For example:

- show CTR, not only raw clicks
- show report density, not only total reports
- show moderation turnaround, not only closed report counts
- show month-over-month movement, not only lifetime totals

The best dashboards answer a question, not just show numbers.

#### Done criteria

This stage is done when:

- the main business-owner questions are answerable from the dashboard
- the main admin moderation questions are answerable from the dashboard
- the data is visually understandable at a glance

### Stage 9: Validation, testing, and report alignment

#### Main responsibility

This stage verifies that the analytics are correct and that the implementation is defensible academically.

#### Why this stage exists

Reporting can look right while being numerically wrong.

This stage protects you against:

- incorrect formulas
- broken grouping
- duplicated aggregation
- misleading seeded data

#### What this stage is responsible for

- testing formulas
- testing query correctness
- testing aggregation consistency
- validating dashboard outputs against raw data
- aligning implementation with dissertation/report language

#### Recommended implementation tasks

- unit tests for CTR and conversion calculations
- integration tests for analytics queries
- aggregation tests for daily summary generation
- manual validation using seeded sample promotions
- screenshots and sample cases for academic documentation

#### Academic responsibility

This stage should leave you able to explain:

- what data is collected
- how it is transformed
- how each metric is calculated
- how the dashboards support decision-making
- how moderation analytics improve platform trust and governance

#### Done criteria

This stage is done when:

- the numbers match expected results
- you can explain each dashboard card and chart confidently
- your implementation and report tell the same story

## Recommended order of execution in practice

If you want a practical build order, do it like this:

1. Stage 1 and Stage 2
2. Stage 3
3. Stage 4
4. Stage 6
5. Stage 5
6. Stage 7
7. Stage 8
8. Stage 9

Why this order:

- you need definitions and schema first
- you need raw capture before analytics
- you should prove raw queries before optimizing
- you want seed data before polishing dashboards
- aggregation should come after raw analytics logic is trusted

## Who each stage primarily serves

- Stage 1 serves correctness
- Stage 2 serves data integrity
- Stage 3 serves traceability
- Stage 4 serves analytics logic
- Stage 5 serves performance
- Stage 6 serves demonstrability
- Stage 7 serves integration and security
- Stage 8 serves usability
- Stage 9 serves confidence and academic defense

## Extra ideas worth adding

These are strong but still manageable.

### 1. Moderation impact analysis

Show how promotion performance changes after:

- being flagged
- being approved
- being rejected

### 2. Business trust score

Simple weighted score from:

- approved promotions
- rejected promotions
- flagged promotions
- resolved reports

This is academically attractive and easy to explain.

### 3. SLA reporting for admins

Track:

- average time to first review
- average time to close a report
- backlog by status

This makes the admin dashboard look operational, not cosmetic.

### 4. Recommendation engine without ML

Examples:

- "Your food promotions convert best on weekends."
- "Promotions with percentage discounts outperform fixed discounts for your business."
- "This category gets high views but low redemptions. Review pricing or redemption terms."

### 5. Promotion health score

A single score built from:

- CTR
- conversion rate
- report density
- moderation penalties

This gives business owners one quick indicator.

## Final recommendation

If you want strong scope without bloat, implement these first:

1. `promotion_engagement_events`
2. `promotion_moderation_events`
3. promotion performance analytics
4. funnel analysis
5. daily trends
6. category performance
7. business dashboard
8. admin moderation dashboard

That gives you a complete reporting story:

- what users did
- how promotions performed
- what admins did about risky promotions
- how businesses can improve decisions from the data

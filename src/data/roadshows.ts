export type RoadshowEvent = {
  id: string;
  title: string;
  organizer: string;
  dateRange: string;
  timeRange: string;
  location: string;
  venue: string;
  description: string;
  category: "Expo" | "Product launch" | "Trade fair" | "Promo event";
  badge?: "Upcoming" | "This week" | "Multi-day";
  timeframe: "Upcoming" | "This week" | "This month";
  overview: string;
  startDate: string;
  endDate: string;
  contactEmail?: string;
  whatToExpect?: string[];
};

export const roadshowEvents: RoadshowEvent[] = [
  {
    id: "harare-sme-trade-expo",
    title: "Harare SME Trade Expo",
    organizer: "XYZ Business Network",
    dateRange: "20–22 April 2026",
    timeRange: "09:00–17:00",
    location: "Harare • Harare Showgrounds",
    venue: "Harare Showgrounds",
    description: "A three-day showcase for Zimbabwean SMEs featuring product demos and partnerships.",
    category: "Expo",
    badge: "Multi-day",
    timeframe: "This month",
    overview:
      "Harare SME Trade Expo connects emerging businesses with buyers, suppliers, and investors. Explore new products, attend live demonstrations, and build lasting partnerships.",
    startDate: "20 April 2026",
    endDate: "22 April 2026",
    contactEmail: "events@xyzbusiness.co.zw",
    whatToExpect: ["Product demos", "On-site promotions", "Networking opportunities"],
  },
  {
    id: "bulawayo-product-launch-week",
    title: "Bulawayo Product Launch Week",
    organizer: "BrightTech Innovations",
    dateRange: "5–7 May 2026",
    timeRange: "10:00–15:00",
    location: "Bulawayo • Rainbow Plaza",
    venue: "Rainbow Plaza",
    description: "A focused launch week for new consumer tech products and services.",
    category: "Product launch",
    badge: "Upcoming",
    timeframe: "Upcoming",
    overview:
      "BrightTech Innovations invites customers and retailers to preview new devices, attend demonstrations, and connect with product teams for early feedback.",
    startDate: "5 May 2026",
    endDate: "7 May 2026",
    contactEmail: "launch@brighttech.co.zw",
    whatToExpect: ["Product demos", "Early access offers", "Meet the makers"],
  },
  {
    id: "mutare-trade-fair",
    title: "Mutare Regional Trade Fair",
    organizer: "Eastern Growth Council",
    dateRange: "14–15 May 2026",
    timeRange: "09:30–16:30",
    location: "Mutare • Civic Centre Hall",
    venue: "Civic Centre Hall",
    description: "Regional trade fair spotlighting agriculture, retail, and logistics partners.",
    category: "Trade fair",
    badge: "Upcoming",
    timeframe: "Upcoming",
    overview:
      "Meet trusted suppliers, compare offerings, and explore regional growth opportunities in one focused trade fair for Eastern Zimbabwe.",
    startDate: "14 May 2026",
    endDate: "15 May 2026",
    contactEmail: "tradefair@egc.org.zw",
    whatToExpect: ["Supplier showcases", "Local partnership booths", "Business clinics"],
  },
  {
    id: "gweru-promo-weekend",
    title: "Gweru City Promo Weekend",
    organizer: "Midlands Retail Alliance",
    dateRange: "23 May 2026",
    timeRange: "10:00–18:00",
    location: "Gweru • Midlands Mall",
    venue: "Midlands Mall Atrium",
    description: "A one-day promotional event with verified retailers and service providers.",
    category: "Promo event",
    badge: "This week",
    timeframe: "This week",
    overview:
      "Discover curated promotions from Midlands-based businesses and enjoy pop-up activations designed for families and professionals.",
    startDate: "23 May 2026",
    endDate: "23 May 2026",
    contactEmail: "promos@midlandsalliance.co.zw",
    whatToExpect: ["On-site promotions", "Vendor pop-ups", "Live demos"],
  },
];

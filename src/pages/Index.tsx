import { Navbar } from "@/components/Navbar";
import { PromotionCard } from "@/components/PromotionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldCheck, FileCheck, Bell, Search, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type Event, type Promotion } from "@/lib/api";
import { formatDate, formatDiscount } from "@/lib/format";
import { toast } from "@/components/ui/sonner";

const Index = () => {
  const [featuredPromotions, setFeaturedPromotions] = useState<Promotion[]>([]);
  const [roadshows, setRoadshows] = useState<Event[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [promotionsResponse, eventsResponse] = await Promise.all([
          api.getPromotions({ page: "0", size: "4" }),
          api.getEvents(),
        ]);

        const promotions = Array.isArray(promotionsResponse)
          ? promotionsResponse
          : promotionsResponse.content;
        const events = Array.isArray(eventsResponse) ? eventsResponse : eventsResponse.content;

        if (isMounted) {
          setFeaturedPromotions(promotions.slice(0, 4));
          setRoadshows(events.slice(0, 3));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load homepage data.";
        toast.error(message);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--hero-gradient)] opacity-5" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 bg-verified/10 text-verified px-4 py-2 rounded-full mb-6">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-medium">100% Verified Promotions</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Real Deals.<br />No Scams.
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover verified promotions from trusted businesses across Zimbabwe. Every deal is reviewed and authenticated.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="text-lg px-8">
                <Link to="/browse">Browse Promotions</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg px-8">
                <Link to="/register">Business? Get Verified</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-muted/50 py-8 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search promotions..."
                  className="pl-10 h-12"
                />
              </div>
              <select className="h-12 px-4 rounded-md border border-input bg-background text-foreground">
                <option>All Categories</option>
                <option>Electronics</option>
                <option>Groceries</option>
                <option>Fashion</option>
                <option>Food & Beverages</option>
              </select>
              <select className="h-12 px-4 rounded-md border border-input bg-background text-foreground">
                <option>All Locations</option>
                <option>Harare</option>
                <option>Bulawayo</option>
                <option>Gweru</option>
              </select>
              <Button className="h-12 px-8">Search</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Promotions */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Featured Verified Promotions</h2>
              <p className="text-muted-foreground">Handpicked deals from trusted businesses</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/browse">View All</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredPromotions.map((promo, index) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <PromotionCard
                  id={promo.id.toString()}
                  title={promo.title}
                  businessName={promo.businessName}
                  category={promo.categoryName}
                  discount={formatDiscount(promo.discountType, promo.discountValue)}
                  location={promo.location}
                  validUntil={formatDate(promo.endDate)}
                  isVerified={["APPROVED", "ACTIVE"].includes(promo.status)}
                  imageUrl={promo.imageUrl}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadshows & Events */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Roadshows & Events</h2>
              <p className="text-muted-foreground">
                Plan ahead with verified business roadshows, expos, and promo events.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/roadshows">View all events</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roadshows.slice(0, 3).map((event) => (
              <div key={event.id} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Hosted by {event.businessName}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {formatDate(event.startDate)} • {event.location}
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/roadshows/${event.id}`}>View details</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">How PromoHub Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We ensure every promotion is legitimate through our rigorous verification process
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Businesses Register",
                description: "Companies submit their business documents for verification",
              },
              {
                icon: FileCheck,
                title: "Admin Reviews",
                description: "Our team verifies business authenticity and documentation",
              },
              {
                icon: TrendingUp,
                title: "Promotions Go Live",
                description: "Only verified businesses can publish promotions",
              },
              {
                icon: Bell,
                title: "Community Reports",
                description: "Users can flag suspicious promotions for review",
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[image:var(--hero-gradient)] text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Share Your Promotions?
            </h2>
            <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
              Join hundreds of verified businesses reaching customers across Zimbabwe
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">Get Your Business Verified</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 font-bold text-xl text-primary mb-4">
                <Shield className="h-6 w-6" />
                <span>PromoHub</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Verified promotions you can trust
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/browse" className="hover:text-foreground">Browse Promotions</Link></li>
                <li><Link to="/roadshows" className="hover:text-foreground">Roadshows & Events</Link></li>
                <li><Link to="/how-it-works" className="hover:text-foreground">About</Link></li>
                <li><Link to="/register" className="hover:text-foreground">For Businesses</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground">Report an Issue</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/how-it-works" className="hover:text-foreground">Terms of Service</Link></li>
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">About Us</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; 2026 PromoHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
